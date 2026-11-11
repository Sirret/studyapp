import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
	CRITERION_FIRST,
	CRITERION_FIRST_DEGRADED,
	RELEARN_SESSIONS_MAX
} from '#lib/config/defaults.ts';
import { planCuts, type CourseCuts, type PlanDegradation } from '#lib/engine/planner-cuts.ts';
import {
	courseWork,
	demandCheck,
	type PlanCourse,
	type PlanItem
} from '#lib/engine/planner-work.ts';
import { AT_RISK, SECURE } from './cram-fixtures.ts';
import { cardId, courseId, NUM_RUNS } from './fixtures.ts';
import {
	course,
	cutsInput,
	FULL_KNOBS,
	newItem,
	PLAN_CTX,
	reorder,
	reviewedItem,
	unitItem,
	unitKey
} from './planner-fixtures.ts';

/**
 * With one minute per attempt, a new cloze card's work (× SAFETY_MARGIN, ceil) is 18 at full
 * knobs, 15 at criterion 2, 12 at K = 2 and 9 at K = 1.
 *
 * @see BUILD_PLAN §6.9 ("Cuts", "The planner, concretely" → Cuts), §6.6 Feasibility degrade order
 */

const ORDER: PlanDegradation[] = ['criterion', 'relearning', 'cut'];

function byCourse(cuts: CourseCuts[]): Map<string, CourseCuts> {
	return new Map(cuts.map((c) => [c.courseId, c]));
}

/** Every exam fits on the returned work. */
function allFit(
	courses: readonly PlanCourse[],
	cuts: CourseCuts[],
	input: ReturnType<typeof cutsInput>
) {
	const work = byCourse(cuts);
	return demandCheck({
		exams: courses.map((c) => ({
			courseId: c.courseId,
			examDay: c.examDay,
			workMinutes: work.get(c.courseId)!.workMinutes
		})),
		today: input.today,
		dayMinutes: input.dayMinutes,
		examMorningMinutes: input.examMorningMinutes
	}).result.every((check) => check.fits);
}

describe('planCuts: nothing to cut', () => {
	it('keeps CRITERION_FIRST and RELEARN_SESSIONS_MAX, no degradations, when every exam fits', () => {
		const courses = [
			course(1, 2, [newItem(1), reviewedItem(2, AT_RISK, 'at-risk', 0.4)]),
			course(2, 4, [unitItem(unitKey(3), 10, 2, 'high')])
		];
		const { result } = planCuts(cutsInput(courses, [500, 500, 500, 500]));
		expect(result.map((c) => c.courseId)).toEqual([courseId(1), courseId(2)]);
		for (const [i, c] of result.entries()) {
			expect(c.knobs).toEqual(FULL_KNOBS);
			expect(c.degradations).toEqual([]);
			expect(c.cutIds).toEqual([]);
			expect(c.workMinutes).toBe(courseWork(courses[i]!, FULL_KNOBS, PLAN_CTX));
		}
	});

	it('returns courses in input order', () => {
		const courses = [course(3, 5, [newItem(1)]), course(1, 1, [newItem(2)]), course(2, 3, [])];
		const { result } = planCuts(cutsInput(courses, [500, 500, 500, 500, 500]));
		expect(result.map((c) => c.courseId)).toEqual([courseId(3), courseId(1), courseId(2)]);
	});
});

describe('planCuts: degrade order criterion → relearning → cut', () => {
	const one = [course(1, 1, [newItem(1)])];

	it('first lowers the criterion to CRITERION_FIRST_DEGRADED and stops once it fits', () => {
		const [c] = planCuts(cutsInput(one, [15])).result;
		expect(c).toEqual({
			courseId: courseId(1),
			knobs: { criterion: CRITERION_FIRST_DEGRADED, relearn: RELEARN_SESSIONS_MAX },
			degradations: ['criterion'],
			cutIds: [],
			workMinutes: 15
		});
	});

	it('counts the exam morning in the supply', () => {
		const [c] = planCuts(cutsInput(one, [10], { examMorningMinutes: 5 })).result;
		expect(c!.degradations).toEqual(['criterion']);
		expect(c!.workMinutes).toBe(15);
	});

	it('then lowers K by one at a time, stopping as soon as it fits', () => {
		const [c] = planCuts(cutsInput(one, [12])).result;
		expect(c!.knobs).toEqual({ criterion: CRITERION_FIRST_DEGRADED, relearn: 2 });
		expect(c!.degradations).toEqual(['criterion', 'relearning']);
		expect(c!.cutIds).toEqual([]);
		expect(c!.workMinutes).toBe(12);
	});

	it('lowers K down to 1 and lists relearning only once', () => {
		const [c] = planCuts(cutsInput(one, [9])).result;
		expect(c!.knobs).toEqual({ criterion: CRITERION_FIRST_DEGRADED, relearn: 1 });
		expect(c!.degradations).toEqual(['criterion', 'relearning']);
		expect(c!.workMinutes).toBe(9);
	});

	it('cuts items only after K reaches 1', () => {
		const [c] = planCuts(cutsInput(one, [5])).result;
		expect(c).toEqual({
			courseId: courseId(1),
			knobs: { criterion: CRITERION_FIRST_DEGRADED, relearn: 1 },
			degradations: ['criterion', 'relearning', 'cut'],
			cutIds: [cardId(1)],
			workMinutes: 0
		});
	});

	it('an exam today with no exam morning cuts everything of its course', () => {
		const [c] = planCuts(cutsInput([course(1, 0, [newItem(1), newItem(2)])], [500])).result;
		expect(c!.cutIds).toEqual([cardId(1), cardId(2)]);
		expect(c!.workMinutes).toBe(0);
	});
});

describe('planCuts: which items go', () => {
	// Four new cards at K = 1: 4 × 7.5 = 30 minutes → work 36; each card removed saves 9.
	const four = () => [
		course(1, 1, [newItem(1, 'high'), newItem(2), newItem(3), newItem(4, 'high')])
	];

	it('removes only as many items as the exam needs to fit', () => {
		expect(planCuts(cutsInput(four(), [27])).result[0]!.cutIds).toHaveLength(1);
		expect(planCuts(cutsInput(four(), [26])).result[0]!.cutIds).toHaveLength(2);
	});

	it('removes the lowest value per minute first, ties by item ID', () => {
		expect(planCuts(cutsInput(four(), [27])).result[0]!.cutIds).toEqual([cardId(2)]);
		expect(planCuts(cutsInput(four(), [18])).result[0]!.cutIds).toEqual([cardId(2), cardId(3)]);
		expect(planCuts(cutsInput(four(), [9])).result[0]!.cutIds).toEqual([
			cardId(2),
			cardId(3),
			cardId(1)
		]);
	});

	it('ranks by value ÷ minutes, not by value alone', () => {
		// The unit is worth more (high, 1 card) but costs 100 + 7.5 minutes; the card 7.5.
		const courses = [course(1, 1, [unitItem(unitKey(1), 100, 1, 'high'), newItem(2)])];
		const [c] = planCuts(cutsInput(courses, [120])).result;
		expect(c!.cutIds).toEqual([unitKey(1)]);
		expect(c!.workMinutes).toBe(9);
	});

	it('removes a secure card (value 0) before anything with value', () => {
		const courses = [course(1, 1, [newItem(1), reviewedItem(2, SECURE, 'secure', 0.99)])];
		const [c] = planCuts(cutsInput(courses, [9])).result;
		expect(c!.cutIds).toEqual([cardId(2)]);
	});

	it('breaks ratio ties across courses by course ID before item ID', () => {
		const courses = [course(2, 1, [newItem(1)]), course(1, 1, [newItem(2)])];
		const cuts = byCourse(planCuts(cutsInput(courses, [9])).result);
		expect(cuts.get(courseId(1))!.cutIds).toEqual([cardId(2)]);
		expect(cuts.get(courseId(2))!.cutIds).toEqual([]);
		expect(cuts.get(courseId(2))!.degradations).toEqual(['criterion', 'relearning']);
	});
});

describe('planCuts: which courses are touched', () => {
	it('leaves courses whose exam is after the failing exam alone', () => {
		const courses = [course(1, 1, [newItem(1)]), course(2, 4, [newItem(2)])];
		const cuts = byCourse(planCuts(cutsInput(courses, [15, 100, 100, 100])).result);
		expect(cuts.get(courseId(1))!.degradations).toEqual(['criterion']);
		expect(cuts.get(courseId(2))).toEqual({
			courseId: courseId(2),
			knobs: FULL_KNOBS,
			degradations: [],
			cutIds: [],
			workMinutes: 18
		});
	});

	it('a later failing exam degrades every course with an exam on or before its day', () => {
		// A alone fits (18 ≤ 20); A + B = 54 > 50 → both to criterion 2: 15 + 30 = 45.
		const courses = [course(1, 1, [newItem(1)]), course(2, 2, [newItem(2), newItem(3)])];
		const cuts = byCourse(planCuts(cutsInput(courses, [20, 30])).result);
		for (const id of [courseId(1), courseId(2)]) {
			expect(cuts.get(id)!.knobs).toEqual({
				criterion: CRITERION_FIRST_DEGRADED,
				relearn: RELEARN_SESSIONS_MAX
			});
			expect(cuts.get(id)!.degradations).toEqual(['criterion']);
		}
		expect(cuts.get(courseId(2))!.workMinutes).toBe(30);
	});

	it('lists each step once per course, in first-applied order, across several failing exams', () => {
		// Exam 1: A 18 > 15 → criterion (15). Exam 2: 15 + 18 > 25 → B criterion (30 > 25)
		// → K = 2 for both (12 + 12 = 24 ≤ 25).
		const courses = [course(1, 1, [newItem(1)]), course(2, 2, [newItem(2)])];
		const cuts = byCourse(planCuts(cutsInput(courses, [15, 10])).result);
		for (const id of [courseId(1), courseId(2)]) {
			expect(cuts.get(id)!.knobs).toEqual({ criterion: CRITERION_FIRST_DEGRADED, relearn: 2 });
			expect(cuts.get(id)!.degradations).toEqual(['criterion', 'relearning']);
			expect(cuts.get(id)!.workMinutes).toBe(12);
		}
	});
});

describe('planCuts: determinism', () => {
	const courses = () => [
		course(1, 1, [newItem(1), newItem(2, 'high'), unitItem(unitKey(3), 20, 2)]),
		course(2, 2, [reviewedItem(4, AT_RISK, 'at-risk', 0.3), newItem(5), newItem(6)]),
		course(3, 4, [
			newItem(7),
			reviewedItem(8, SECURE, 'secure', 0.97),
			unitItem(unitKey(9), 5, 1, 'high')
		])
	];
	const days = [20, 15, 10, 30];

	it('the same input gives an identical result and trace', () => {
		const input = cutsInput(courses(), days);
		expect(planCuts(input)).toEqual(planCuts(cutsInput(courses(), days)));
	});

	it('shuffling item and course order gives the same cuts per course', () => {
		const a = byCourse(planCuts(cutsInput(courses(), days)).result);
		const shuffled = reorder(courses()).map((c) => ({ ...c, items: reorder(c.items) }));
		const b = byCourse(planCuts(cutsInput(shuffled, days)).result);
		expect(b).toEqual(a);
	});
});

/** Random courses with globally unique item IDs. */
const coursesArb = fc
	.array(
		fc.record({
			examDay: fc.integer({ min: 0, max: 6 }),
			items: fc.array(
				fc.record({
					kind: fc.constantFrom('new', 'at-risk', 'secure', 'unit'),
					high: fc.boolean(),
					rExam: fc.double({ min: 0, max: 1, noNaN: true }),
					learn: fc.integer({ min: 0, max: 60 }),
					cards: fc.integer({ min: 0, max: 4 })
				}),
				{ maxLength: 6 }
			)
		}),
		{ minLength: 1, maxLength: 4 }
	)
	.map((raw) => {
		let n = 0;
		return raw.map((r, i): PlanCourse => {
			const items = r.items.map((it): PlanItem => {
				n += 1;
				const priority = it.high ? 'high' : 'normal';
				switch (it.kind) {
					case 'new':
						return newItem(n, priority);
					case 'at-risk':
						return reviewedItem(n, AT_RISK, 'at-risk', it.rExam, priority);
					case 'secure':
						return reviewedItem(n, SECURE, 'secure', it.rExam, priority);
					default:
						return unitItem(unitKey(n), it.learn, it.cards, priority);
				}
			});
			return course(i + 1, r.examDay, items);
		});
	});

describe('planCuts: properties', () => {
	it('afterwards every exam fits, and the knobs, steps and work are consistent', () => {
		fc.assert(
			fc.property(
				coursesArb,
				fc.array(fc.integer({ min: 0, max: 120 }), { minLength: 7, maxLength: 7 }),
				fc.integer({ min: 0, max: 30 }),
				(courses, dayMinutes, morning) => {
					const input = cutsInput(courses, dayMinutes, { examMorningMinutes: morning });
					const { result } = planCuts(input);
					expect(result.map((c) => c.courseId)).toEqual(courses.map((c) => c.courseId));
					expect(allFit(courses, result, input)).toBe(true);
					for (const [i, c] of result.entries()) {
						const src = courses[i]!;
						expect([CRITERION_FIRST, CRITERION_FIRST_DEGRADED]).toContain(c.knobs.criterion);
						expect(Number.isInteger(c.knobs.relearn)).toBe(true);
						expect(c.knobs.relearn).toBeGreaterThanOrEqual(1);
						expect(c.knobs.relearn).toBeLessThanOrEqual(RELEARN_SESSIONS_MAX);
						expect(c.degradations).toEqual(ORDER.filter((s) => c.degradations.includes(s)));
						expect(c.degradations.includes('criterion')).toBe(
							c.knobs.criterion === CRITERION_FIRST_DEGRADED
						);
						expect(c.degradations.includes('relearning')).toBe(
							c.knobs.relearn < RELEARN_SESSIONS_MAX
						);
						expect(c.degradations.includes('cut')).toBe(c.cutIds.length > 0);
						if (c.knobs.relearn < RELEARN_SESSIONS_MAX) {
							expect(c.knobs.criterion).toBe(CRITERION_FIRST_DEGRADED);
						}
						if (c.cutIds.length > 0) expect(c.knobs.relearn).toBe(1);
						expect(new Set(c.cutIds).size).toBe(c.cutIds.length);
						const ids = new Set(src.items.map((item) => item.id));
						for (const id of c.cutIds) expect(ids.has(id)).toBe(true);
						expect(c.workMinutes).toBe(courseWork(src, c.knobs, PLAN_CTX, new Set(c.cutIds)));
					}
				}
			),
			{ numRuns: NUM_RUNS }
		);
	});

	it('degrades nothing when every exam fits at full knobs', () => {
		fc.assert(
			fc.property(coursesArb, (courses) => {
				const input = cutsInput(courses, [100_000, 100_000, 100_000, 100_000, 100_000, 100_000], {
					examMorningMinutes: 100_000
				});
				for (const c of planCuts(input).result) {
					expect(c.knobs).toEqual(FULL_KNOBS);
					expect(c.degradations).toEqual([]);
					expect(c.cutIds).toEqual([]);
				}
			}),
			{ numRuns: NUM_RUNS }
		);
	});

	it('is deterministic and independent of item order', () => {
		fc.assert(
			fc.property(
				coursesArb,
				fc.array(fc.integer({ min: 0, max: 60 }), { minLength: 7, maxLength: 7 }),
				(courses, dayMinutes) => {
					const a = planCuts(cutsInput(courses, dayMinutes));
					expect(planCuts(cutsInput(courses, dayMinutes))).toEqual(a);
					const shuffled = courses.map((c) => ({ ...c, items: reorder(c.items) }));
					expect(planCuts(cutsInput(shuffled, dayMinutes)).result).toEqual(a.result);
				}
			),
			{ numRuns: NUM_RUNS }
		);
	});
});
