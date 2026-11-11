import { describe, expect, it } from 'vitest';
import {
	CRITERION_FIRST,
	CRITERION_FIRST_DEGRADED,
	P0,
	PRIORITY_WEIGHT,
	RELEARN_SESSIONS_MAX,
	RETENTION,
	SAFETY_MARGIN
} from '#lib/config/defaults.ts';
import { cardMinutes, type Standing } from '#lib/engine/estimate.ts';
import {
	courseWork,
	demandCheck,
	itemMinutes,
	itemValue,
	type PlanKnobs
} from '#lib/engine/planner-work.ts';
import { AT_RISK, SECURE } from './cram-fixtures.ts';
import { courseId } from './fixtures.ts';
import {
	course,
	estCard,
	estimateCtx,
	FULL_KNOBS,
	newItem,
	PLAN_CTX,
	reorder,
	reviewedItem,
	unitItem,
	unitKey
} from './planner-fixtures.ts';

/** @see BUILD_PLAN §6.9 ("Workload estimate", "Feasibility", "The planner, concretely") */

const DEGRADED: PlanKnobs[] = [
	FULL_KNOBS,
	{ criterion: CRITERION_FIRST_DEGRADED, relearn: RELEARN_SESSIONS_MAX },
	{ criterion: CRITERION_FIRST_DEGRADED, relearn: 2 },
	{ criterion: CRITERION_FIRST_DEGRADED, relearn: 1 }
];

describe('itemMinutes', () => {
	const cases: { standing: Standing; fsrs: typeof AT_RISK | null }[] = [
		{ standing: 'new', fsrs: null },
		{ standing: 'at-risk', fsrs: AT_RISK },
		{ standing: 'secure', fsrs: SECURE }
	];

	for (const { standing, fsrs } of cases) {
		it(`a ${standing} card costs cardMinutes for its standing at the knobs (no margin)`, () => {
			for (const knobs of DEGRADED) {
				const item =
					standing === 'new'
						? newItem(1)
						: reviewedItem(1, fsrs!, standing as 'at-risk' | 'secure', 0.5);
				expect(itemMinutes(item, knobs, PLAN_CTX)).toBeCloseTo(
					cardMinutes(estCard(fsrs), standing, estimateCtx(knobs)),
					9
				);
			}
		});
	}

	it('a new cloze card at full knobs costs k / p0 + K / p0 attempts of one minute', () => {
		const expected = CRITERION_FIRST / P0.concept + RELEARN_SESSIONS_MAX / P0.concept;
		expect(itemMinutes(newItem(1), FULL_KNOBS, PLAN_CTX)).toBeCloseTo(expected, 9);
	});

	it('a unit costs its learnMinutes plus its cards as new cards', () => {
		for (const knobs of DEGRADED) {
			const perCard = cardMinutes(estCard(), 'new', estimateCtx(knobs));
			expect(itemMinutes(unitItem(unitKey(1), 7, 3), knobs, PLAN_CTX)).toBeCloseTo(
				7 + 3 * perCard,
				9
			);
		}
	});

	it('a unit with no cards costs only its learnMinutes', () => {
		expect(itemMinutes(unitItem(unitKey(1), 12.5, 0), FULL_KNOBS, PLAN_CTX)).toBeCloseTo(12.5, 9);
	});

	it('degrading the knobs lowers a new card and a unit, never the learnMinutes part', () => {
		const full = itemMinutes(unitItem(unitKey(1), 20, 2), FULL_KNOBS, PLAN_CTX);
		const low = itemMinutes(unitItem(unitKey(1), 20, 2), DEGRADED[3]!, PLAN_CTX);
		expect(low).toBeLessThan(full);
		expect(low).toBeGreaterThan(20);
	});
});

describe('itemValue', () => {
	it('a card is PRIORITY_WEIGHT[priority] × (R_target − R_exam)', () => {
		const item = reviewedItem(1, AT_RISK, 'at-risk', 0.5);
		expect(itemValue(item, RETENTION)).toBeCloseTo(PRIORITY_WEIGHT.normal * (RETENTION - 0.5), 9);
		const high = reviewedItem(2, AT_RISK, 'at-risk', 0.5, 'high');
		expect(itemValue(high, RETENTION)).toBeCloseTo(PRIORITY_WEIGHT.high * (RETENTION - 0.5), 9);
	});

	it('a new card (R_exam = 0) is worth PRIORITY_WEIGHT × R_target', () => {
		expect(itemValue(newItem(1, 'high'), RETENTION)).toBeCloseTo(
			PRIORITY_WEIGHT.high * RETENTION,
			9
		);
	});

	it('uses the given R_target (Settings.retention), not a constant', () => {
		expect(itemValue(newItem(1), 0.8)).toBeCloseTo(PRIORITY_WEIGHT.normal * 0.8, 9);
	});

	it('clamps at 0 for a card whose R_exam is at or above R_target', () => {
		expect(itemValue(reviewedItem(1, SECURE, 'secure', 0.99), RETENTION)).toBe(0);
		expect(itemValue(reviewedItem(2, SECURE, 'secure', RETENTION), RETENTION)).toBe(0);
	});

	it('a unit is PRIORITY_WEIGHT × R_target × its card count', () => {
		expect(itemValue(unitItem(unitKey(1), 5, 4, 'high'), RETENTION)).toBeCloseTo(
			PRIORITY_WEIGHT.high * RETENTION * 4,
			9
		);
		expect(itemValue(unitItem(unitKey(2), 5, 0), RETENTION)).toBe(0);
	});
});

describe('courseWork', () => {
	it('is ceil(Σ item minutes × SAFETY_MARGIN)', () => {
		const items = [
			newItem(1),
			reviewedItem(2, AT_RISK, 'at-risk', 0.4),
			unitItem(unitKey(3), 7, 1)
		];
		const sum = items.reduce((s, item) => s + itemMinutes(item, FULL_KNOBS, PLAN_CTX), 0);
		const work = courseWork(course(1, 3, items), FULL_KNOBS, PLAN_CTX);
		expect(Number.isInteger(work)).toBe(true);
		expect(work).toBe(Math.ceil(sum * SAFETY_MARGIN));
	});

	it('rounds a fractional total up to whole minutes', () => {
		// 7 + 0 cards = 7 minutes × SAFETY_MARGIN → ceil
		const work = courseWork(course(1, 3, [unitItem(unitKey(1), 7, 0)]), FULL_KNOBS, PLAN_CTX);
		expect(work).toBe(Math.ceil(7 * SAFETY_MARGIN));
		expect(work).toBeGreaterThanOrEqual(7 * SAFETY_MARGIN);
	});

	it('a whole-number total stays exact (no extra minute)', () => {
		// one new cloze card at full knobs: 15 minutes × 1.2 = 18
		const minutes = itemMinutes(newItem(1), FULL_KNOBS, PLAN_CTX);
		expect(courseWork(course(1, 3, [newItem(1)]), FULL_KNOBS, PLAN_CTX)).toBe(
			Math.round(minutes * SAFETY_MARGIN)
		);
	});

	it('leaves cut items out', () => {
		const items = [newItem(1), newItem(2), unitItem(unitKey(3), 10, 2)];
		const c = course(1, 3, items);
		const kept = courseWork(course(1, 3, [newItem(2)]), FULL_KNOBS, PLAN_CTX);
		expect(courseWork(c, FULL_KNOBS, PLAN_CTX, new Set([items[0]!.id, unitKey(3)]))).toBe(kept);
	});

	it('is 0 for an empty course or when every item is cut', () => {
		expect(courseWork(course(1, 3, []), FULL_KNOBS, PLAN_CTX)).toBe(0);
		const items = [newItem(1), unitItem(unitKey(2), 4, 1)];
		expect(
			courseWork(course(1, 3, items), FULL_KNOBS, PLAN_CTX, new Set(items.map((i) => i.id)))
		).toBe(0);
	});

	it('does not depend on the order of the items', () => {
		const items = [
			newItem(1),
			reviewedItem(2, AT_RISK, 'at-risk', 0.3),
			reviewedItem(3, SECURE, 'secure', 0.97),
			unitItem(unitKey(4), 3.3, 2),
			newItem(5, 'high')
		];
		for (const knobs of DEGRADED) {
			expect(courseWork(course(1, 3, reorder(items)), knobs, PLAN_CTX)).toBe(
				courseWork(course(1, 3, items), knobs, PLAN_CTX)
			);
		}
	});

	it('uses the knobs: degraded work is never more than full work', () => {
		const c = course(1, 3, [newItem(1), newItem(2), reviewedItem(3, AT_RISK, 'at-risk', 0.3)]);
		const works = DEGRADED.map((knobs) => courseWork(c, knobs, PLAN_CTX));
		for (let i = 1; i < works.length; i++) expect(works[i]).toBeLessThanOrEqual(works[i - 1]!);
		expect(works[3]).toBeLessThan(works[0]!);
	});
});

const exam = (n: number, examDay: number, workMinutes: number) => ({
	courseId: courseId(n),
	examDay,
	workMinutes
});

describe('demandCheck', () => {
	it('fails the first deadline even when the grand total fits', () => {
		// A: exam tomorrow, 100 min; B: exam in 5 days, 10 min. 5 × 30 = 150 ≥ 110 in total.
		const { result } = demandCheck({
			exams: [exam(1, 1, 100), exam(2, 5, 10)],
			today: 0,
			dayMinutes: [30, 30, 30, 30, 30],
			examMorningMinutes: 0
		});
		expect(result[0]).toEqual({
			courseId: courseId(1),
			examDay: 1,
			demandMinutes: 100,
			supplyMinutes: 30,
			shortfallMinutes: 70,
			fits: false
		});
		expect(result[1]).toEqual({
			courseId: courseId(2),
			examDay: 5,
			demandMinutes: 110,
			supplyMinutes: 150,
			shortfallMinutes: 0,
			fits: true
		});
	});

	it('sorts exams by exam day, then course ID', () => {
		const { result } = demandCheck({
			exams: [exam(3, 4, 1), exam(2, 2, 1), exam(4, 2, 1), exam(1, 4, 1)],
			today: 0,
			dayMinutes: [60, 60, 60, 60],
			examMorningMinutes: 0
		});
		expect(result.map((c) => c.courseId)).toEqual([
			courseId(2),
			courseId(4),
			courseId(1),
			courseId(3)
		]);
	});

	it('demand is cumulative over the exams sorted so far; same-day exams share the supply', () => {
		const { result } = demandCheck({
			exams: [exam(1, 2, 10), exam(2, 2, 20), exam(3, 3, 5)],
			today: 0,
			dayMinutes: [40, 40, 40],
			examMorningMinutes: 15
		});
		expect(result.map((c) => c.demandMinutes)).toEqual([10, 30, 35]);
		expect(result.map((c) => c.supplyMinutes)).toEqual([95, 95, 135]);
	});

	it('supply counts the days from today to the day before the exam, plus examMorningMinutes', () => {
		const { result } = demandCheck({
			exams: [exam(1, 103, 0)],
			today: 100,
			dayMinutes: [1, 10, 100, 1000, 10000],
			examMorningMinutes: 7
		});
		expect(result[0]!.supplyMinutes).toBe(1 + 10 + 100 + 7);
	});

	it('an exam today has only the exam morning as supply', () => {
		const { result } = demandCheck({
			exams: [exam(1, 0, 25)],
			today: 0,
			dayMinutes: [500, 500],
			examMorningMinutes: 20
		});
		expect(result[0]).toMatchObject({ supplyMinutes: 20, shortfallMinutes: 5, fits: false });
	});

	it('floors fractional day minutes', () => {
		const { result } = demandCheck({
			exams: [exam(1, 2, 0)],
			today: 0,
			dayMinutes: [30.9, 10.5],
			examMorningMinutes: 0
		});
		expect(result[0]!.supplyMinutes).toBe(40);
	});

	it('counts a missing day as 0', () => {
		const { result } = demandCheck({
			exams: [exam(1, 5, 0)],
			today: 0,
			dayMinutes: [20, 20],
			examMorningMinutes: 3
		});
		expect(result[0]!.supplyMinutes).toBe(43);
	});

	it('fits exactly when demand equals supply (shortfall 0)', () => {
		const { result } = demandCheck({
			exams: [exam(1, 2, 50)],
			today: 0,
			dayMinutes: [20, 20],
			examMorningMinutes: 10
		});
		expect(result[0]).toMatchObject({ shortfallMinutes: 0, fits: true });
		const over = demandCheck({
			exams: [exam(1, 2, 51)],
			today: 0,
			dayMinutes: [20, 20],
			examMorningMinutes: 10
		}).result;
		expect(over[0]).toMatchObject({ shortfallMinutes: 1, fits: false });
	});

	it('an earlier failure makes later exams carry its demand too', () => {
		const { result } = demandCheck({
			exams: [exam(1, 1, 100), exam(2, 2, 10)],
			today: 0,
			dayMinutes: [30, 30],
			examMorningMinutes: 0
		});
		expect(result.map((c) => c.shortfallMinutes)).toEqual([70, 50]);
	});

	it('returns nothing for no exams', () => {
		expect(
			demandCheck({ exams: [], today: 0, dayMinutes: [10], examMorningMinutes: 5 }).result
		).toEqual([]);
	});

	it('is deterministic, trace included, whatever the input order', () => {
		const exams = [exam(1, 3, 40), exam(2, 1, 30), exam(3, 3, 20), exam(4, 6, 90)];
		const input = { today: 0, dayMinutes: [25, 25, 25, 25, 25, 25], examMorningMinutes: 10 };
		const a = demandCheck({ ...input, exams });
		const b = demandCheck({ ...input, exams: reorder(exams) });
		expect(b).toEqual(a);
		expect(a.trace.length).toBeGreaterThan(0);
	});
});
