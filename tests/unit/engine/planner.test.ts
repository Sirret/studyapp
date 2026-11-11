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
	cutsInput,
	FULL_KNOBS,
	newItem,
	PLAN_CTX,
	reviewedItem,
	unitItem,
	unitKey
} from './planner-fixtures.ts';

/**
 * With one minute per attempt, a new cloze card's work is 18 at full knobs, 12 at criterion 2 and
 * K = 2.
 *
 * @see BUILD_PLAN §6.9 ("Feasibility", "The planner, concretely"), CONCEPT §10–§11
 */

const fullExams = (courses: readonly PlanCourse[]) =>
	courses.map((c) => ({
		courseId: c.courseId,
		examDay: c.examDay,
		workMinutes: courseWork(c, FULL_KNOBS, PLAN_CTX)
	}));

describe('planDays', () => {
	it('checks feasibility at full work, before any cuts', () => {
		const courses = [course(1, 1, [newItem(1)]), course(2, 2, [newItem(2)])];
		const input = cutsInput(courses, [15, 10]);
		const { result } = planDays(input);
		expect(result.checks).toEqual(
			demandCheck({
				exams: fullExams(courses),
				today: 0,
				dayMinutes: [15, 10],
				examMorningMinutes: 0
			}).result
		);
		expect(result.checks.map((c) => c.demandMinutes)).toEqual([18, 36]);
	});

	it('is infeasible and names the first exam that does not fit, with its shortfall', () => {
		const courses = [course(1, 1, [newItem(1)]), course(2, 2, [newItem(2)])];
		const { result } = planDays(cutsInput(courses, [15, 10]));
		expect(result.feasible).toBe(false);
		expect(result.firstShort).toEqual({ courseId: courseId(1), examDay: 1, shortfallMinutes: 3 });
	});

	it('names the first failing exam in exam order, not input order', () => {
		// B's exam (day 3) fails on its own; A's (day 1) fails first.
		const courses = [
			course(2, 3, [newItem(2), newItem(3), newItem(4)]),
			course(1, 1, [newItem(1)])
		];
		const { result } = planDays(cutsInput(courses, [10, 5, 5]));
		expect(result.firstShort).toEqual({ courseId: courseId(1), examDay: 1, shortfallMinutes: 8 });
	});

	it('flags the first deadline even when the grand total fits', () => {
		const courses = [
			course(1, 1, [newItem(1), newItem(2), newItem(3)]),
			course(2, 5, [newItem(4)])
		];
		// Total work 72 ≤ 5 × 30 = 150, but exam 1 has 54 work for 30 minutes.
		const { result } = planDays(cutsInput(courses, [30, 30, 30, 30, 30]));
		expect(result.feasible).toBe(false);
		expect(result.firstShort).toEqual({ courseId: courseId(1), examDay: 1, shortfallMinutes: 24 });
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
		const input = cutsInput(courses, [15, 10]);
		expect(planDays(input).result.cuts).toEqual(planCuts(input).result);
	});

	it('splits the days using the work after cuts', () => {
		const courses = [course(1, 1, [newItem(1)]), course(2, 2, [newItem(2)])];
		const input = cutsInput(courses, [15, 10]);
		const { result } = planDays(input);
		expect(result.cuts.map((c) => c.workMinutes)).toEqual([12, 12]);
		expect(result.days).toEqual(
			dailySplit({
				courses: [
					{ courseId: courseId(1), examDay: 1, workMinutes: 12 },
					{ courseId: courseId(2), examDay: 2, workMinutes: 12 }
				],
				today: 0,
				dayMinutes: [15, 10]
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
