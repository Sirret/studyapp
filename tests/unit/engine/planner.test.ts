import { describe, expect, it } from 'vitest';
import {
	courseWork,
	dailySplit,
	demandCheck,
	planCuts,
	planDays,
	type PlanCourse
} from '#lib/engine/planner.ts';
import { AT_RISK } from './cram-fixtures.ts';
import { courseId } from './fixtures.ts';
import {
	course,
	CRITERION_KNOBS,
	cutsInput,
	FULL_KNOBS,
	K2_KNOBS,
	newClozeWork,
	newItem,
	PLAN_CTX,
	reviewedItem,
	unitItem,
	unitKey
} from './planner-fixtures.ts';

/**
 * With one minute per attempt, a new cloze card's work (`newClozeWork`) is 10 at full knobs, 9 at
 * criterion 2 and 7 at criterion 2 and K = 2.
 *
 * @see BUILD_PLAN §6.9 ("Feasibility", "The planner, concretely"), CONCEPT §10–§11
 */

/**
 * Two one-card courses, exams on days 1 and 2: day 0 (9) is one short of A's full work (10); the
 * two days (15) are short of criterion 2 for both (18) but fit K = 2 for both (14).
 */
const DAYS = [
	newClozeWork(CRITERION_KNOBS),
	2 * newClozeWork(K2_KNOBS) + 1 - newClozeWork(CRITERION_KNOBS)
];

const fullExams = (courses: readonly PlanCourse[]) =>
	courses.map((c) => ({
		courseId: c.courseId,
		examDay: c.examDay,
		workMinutes: courseWork(c, FULL_KNOBS, PLAN_CTX)
	}));

describe('planDays', () => {
	it('checks feasibility at full work, before any cuts', () => {
		const courses = [course(1, 1, [newItem(1)]), course(2, 2, [newItem(2)])];
		const input = cutsInput(courses, DAYS);
		const { result } = planDays(input);
		expect(result.checks).toEqual(
			demandCheck({
				exams: fullExams(courses),
				today: 0,
				dayMinutes: DAYS,
				examMorningMinutes: 0
			}).result
		);
		const full = newClozeWork(FULL_KNOBS);
		expect(result.checks.map((c) => c.demandMinutes)).toEqual([full, 2 * full]);
	});

	it('is infeasible and names the first exam that does not fit, with its shortfall', () => {
		const courses = [course(1, 1, [newItem(1)]), course(2, 2, [newItem(2)])];
		const { result } = planDays(cutsInput(courses, DAYS));
		expect(result.feasible).toBe(false);
		expect(result.firstShort).toEqual({
			courseId: courseId(1),
			examDay: 1,
			shortfallMinutes: newClozeWork(FULL_KNOBS) - DAYS[0]!
		});
	});

	it('names the first failing exam in exam order, not input order', () => {
		// B's exam (day 3) fails on its own; A's (day 1) fails first.
		const courses = [
			course(2, 3, [newItem(2), newItem(3), newItem(4)]),
			course(1, 1, [newItem(1)])
		];
		// A: 10 work for 5 minutes. B: 29 work for 15 minutes even without A.
		const { result } = planDays(cutsInput(courses, [5, 5, 5]));
		expect(result.firstShort).toEqual({
			courseId: courseId(1),
			examDay: 1,
			shortfallMinutes: newClozeWork(FULL_KNOBS) - 5
		});
	});

	it('flags the first deadline even when the grand total fits', () => {
		const courses = [
			course(1, 1, [newItem(1), newItem(2), newItem(3)]),
			course(2, 5, [newItem(4)])
		];
		// Total work 29 + 10 = 39 ≤ 5 × 20 = 100, but exam 1 has 29 work for 20 minutes.
		const { result } = planDays(cutsInput(courses, [20, 20, 20, 20, 20]));
		expect(result.feasible).toBe(false);
		expect(result.firstShort).toEqual({
			courseId: courseId(1),
			examDay: 1,
			shortfallMinutes: newClozeWork(FULL_KNOBS, 3) - 20
		});
		expect(result.checks[1]!.fits).toBe(true);
	});

	it('is feasible with firstShort null and no degradations when every exam fits', () => {
		const courses = [course(1, 2, [newItem(1)]), course(2, 3, [unitItem(unitKey(2), 10, 1)])];
		const { result } = planDays(cutsInput(courses, [200, 200, 200]));
		expect(result.feasible).toBe(true);
		expect(result.firstShort).toBeNull();
		expect(result.checks.every((c) => c.fits)).toBe(true);
		for (const c of result.cuts) expect(c.degradations).toEqual([]);
	});

	it('returns planCuts for the cuts', () => {
		const courses = [
			course(1, 1, [newItem(1), reviewedItem(2, AT_RISK, 'at-risk', 0.3)]),
			course(2, 2, [newItem(3)])
		];
		const input = cutsInput(courses, DAYS);
		expect(planDays(input).result.cuts).toEqual(planCuts(input).result);
	});

	it('splits the days using the work after cuts', () => {
		const courses = [course(1, 1, [newItem(1)]), course(2, 2, [newItem(2)])];
		const input = cutsInput(courses, DAYS);
		const { result } = planDays(input);
		const work = newClozeWork(K2_KNOBS);
		expect(result.cuts.map((c) => c.workMinutes)).toEqual([work, work]);
		expect(result.days).toEqual(
			dailySplit({
				courses: [
					{ courseId: courseId(1), examDay: 1, workMinutes: work },
					{ courseId: courseId(2), examDay: 2, workMinutes: work }
				],
				today: 0,
				dayMinutes: DAYS
			}).result
		);
	});

	it('is deterministic, trace included', () => {
		const make = () =>
			cutsInput(
				[
					course(1, 1, [newItem(1), newItem(2, 'high')]),
					course(2, 3, [unitItem(unitKey(3), 15, 2), reviewedItem(4, AT_RISK, 'at-risk', 0.2)])
				],
				[20, 20, 20],
				{ examMorningMinutes: 10 }
			);
		const a = planDays(make());
		expect(planDays(make())).toEqual(a);
		expect(a.trace.length).toBeGreaterThan(0);
	});
});
