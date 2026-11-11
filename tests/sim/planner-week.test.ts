import { describe, expect, it } from 'vitest';
import type { FsrsCardState } from '#lib/db/schemas/card.ts';
import { DEFAULT_FSRS_CONFIG, retrievabilityAt } from '#lib/engine/fsrs.ts';
import {
	courseWork,
	demandCheck,
	planDays,
	type PlannerInput,
	type PlannerResult,
	type PlanCourse,
	type PlanItem
} from '#lib/engine/planner.ts';
import {
	AT_RISK,
	AT_RISK_LONG,
	examAtFor,
	FORGOTTEN,
	SECURE
} from '../unit/engine/cram-fixtures.ts';
import { courseId } from '../unit/engine/fixtures.ts';
import {
	cutsInput,
	FULL_KNOBS,
	newItem,
	PLAN_CTX,
	reviewedItem,
	unitItem,
	unitKey
} from '../unit/engine/planner-fixtures.ts';
import { writeSimReport, type SimDay, type SimReport, type SimRow } from './harness.ts';

/**
 * Scenario "planner-week": four exams in one week (days 2, 3, 5 and 6), each course a mix of new,
 * at-risk and secure cards and acquisition units of both priorities, planned under three
 * availabilities (generous, uneven, tight). Every plan must be feasible or flagged (the first
 * failing exam named, and every exam fitting after the cuts), identical when planned twice (trace
 * included), within each day's cap, and never starve a course with work left.
 *
 * @see BUILD_PLAN §6.9 ("The planner, concretely", Done when), CONCEPT §10–§11
 */

const SCENARIO = 'planner-week';
/** No randomness is involved; the seed only labels the report. */
const SEED = 0;
const EXAM_DAYS = [2, 3, 5, 6] as const;

let next = 0;
const id = () => (next += 1);

function reviewed(state: FsrsCardState, examDay: number, high = false): PlanItem {
	const rExam = retrievabilityAt(state, examAtFor(examDay), DEFAULT_FSRS_CONFIG);
	const standing = state === SECURE ? 'secure' : 'at-risk';
	return reviewedItem(id(), state, standing, rExam, high ? 'high' : 'normal');
}

/** Course `i` (1-based) with its exam on `examDay`; mixes vary per course. */
function weekCourse(i: number, examDay: number): PlanCourse {
	const items: PlanItem[] = [
		newItem(id(), i % 2 === 0 ? 'high' : 'normal'),
		newItem(id()),
		reviewed(AT_RISK, examDay, i === 1),
		reviewed(AT_RISK_LONG, examDay),
		reviewed(FORGOTTEN, examDay, i === 3),
		reviewed(SECURE, examDay),
		unitItem(unitKey(id()), 10 + 5 * i, 2, i <= 2 ? 'high' : 'normal')
	];
	if (i === 4) items.push(unitItem(unitKey(id()), 25, 3, 'high'), newItem(id(), 'high'));
	return { courseId: courseId(i), examDay, items };
}

function weekCourses(): PlanCourse[] {
	next = 0;
	return EXAM_DAYS.map((d, i) => weekCourse(i + 1, d));
}

const AVAILABILITIES: Record<string, number[]> = {
	generous: [900, 900, 900, 900, 900, 900],
	uneven: [120, 0, 45, 200, 30, 90],
	tight: [20, 20, 20, 20, 20, 20]
};

function inputFor(dayMinutes: number[]): PlannerInput {
	return cutsInput(weekCourses(), dayMinutes, { examMorningMinutes: 30 });
}

/** Every problem found with one plan; empty when it meets the spec. */
function problems(input: PlannerInput, plan: PlannerResult, again: unknown): string[] {
	const found: string[] = [];
	if (JSON.stringify(again) !== JSON.stringify(planDays(input))) found.push('not deterministic');
	const firstFail = plan.checks.find((c) => !c.fits) ?? null;
	if (plan.feasible !== (firstFail === null)) found.push('feasible disagrees with the checks');
	const expectedShort = firstFail && {
		courseId: firstFail.courseId,
		examDay: firstFail.examDay,
		shortfallMinutes: firstFail.shortfallMinutes
	};
	if (JSON.stringify(plan.firstShort) !== JSON.stringify(expectedShort)) {
		found.push('firstShort is not the first failing exam');
	}
	const work = new Map(plan.cuts.map((c) => [c.courseId, c.workMinutes]));
	const after = demandCheck({
		exams: input.courses.map((c) => ({
			courseId: c.courseId,
			examDay: c.examDay,
			workMinutes: work.get(c.courseId) ?? NaN
		})),
		today: input.today,
		dayMinutes: input.dayMinutes,
		examMorningMinutes: input.examMorningMinutes
	}).result;
	if (!after.every((c) => c.fits)) found.push('an exam still does not fit after the cuts');
	if (plan.feasible && plan.cuts.some((c) => c.degradations.length > 0)) {
		found.push('feasible plan with degradations');
	}
	const left = new Map(work);
	for (const day of plan.days) {
		const cap = Math.floor(input.dayMinutes[day.day - input.today] ?? 0);
		const active = input.courses.filter((c) => c.examDay > day.day && left.get(c.courseId)! > 0);
		const given = Object.values(day.minutes).reduce((s: number, m) => s + (m ?? 0), 0);
		if (given > cap) found.push(`day ${day.day}: gives ${given} > cap ${cap}`);
		if (day.freeMinutes !== cap - given) found.push(`day ${day.day}: freeMinutes wrong`);
		if (cap >= active.length) {
			for (const c of active) {
				if (!(day.minutes[c.courseId]! > 0)) found.push(`day ${day.day}: ${c.courseId} starved`);
			}
		}
		for (const c of input.courses) {
			const m = day.minutes[c.courseId];
			if (m === undefined) continue;
			if (c.examDay <= day.day) found.push(`day ${day.day}: ${c.courseId} on/after its exam`);
			left.set(c.courseId, left.get(c.courseId)! - m);
		}
	}
	for (const [course, rest] of left) if (rest < 0) found.push(`${course}: given over its work`);
	return found;
}

function reportDays(name: string, input: PlannerInput, plan: PlannerResult): SimDay[] {
	const cutDay: SimDay = {
		day: -1,
		summary: `${name}: feasible=${plan.feasible}, firstShort=${JSON.stringify(plan.firstShort)}`,
		rows: plan.cuts.map((c): SimRow => {
			const src = input.courses.find((x) => x.courseId === c.courseId)!;
			return {
				course: c.courseId.slice(-2),
				exam: src.examDay,
				fullWork: courseWork(src, FULL_KNOBS, PLAN_CTX),
				criterion: c.knobs.criterion,
				K: c.knobs.relearn,
				degradations: c.degradations.join(' → ') || '-',
				cut: c.cutIds.length,
				work: c.workMinutes
			};
		}),
		details: { checks: plan.checks }
	};
	return [
		cutDay,
		...plan.days.map((d): SimDay => ({
			day: d.day,
			summary: `${name}: cap ${Math.floor(input.dayMinutes[d.day - input.today] ?? 0)}, free ${d.freeMinutes}`,
			rows: input.courses.map((c) => ({
				course: c.courseId.slice(-2),
				exam: c.examDay,
				minutes: d.minutes[c.courseId] ?? 0
			}))
		}))
	];
}

describe(`sim: ${SCENARIO}`, () => {
	it('four exams in a week: feasible-or-flagged, deterministic, never starving', () => {
		const days: SimDay[] = [];
		const allProblems: string[] = [];
		const metrics: Record<string, number> = {};
		let error: string | undefined;
		try {
			for (const [name, dayMinutes] of Object.entries(AVAILABILITIES)) {
				const input = inputFor(dayMinutes);
				const first = planDays(input);
				const again = planDays(inputFor(dayMinutes));
				const plan = first.result;
				for (const p of problems(input, plan, again)) allProblems.push(`${name}: ${p}`);
				metrics[`${name}.feasible`] = plan.feasible ? 1 : 0;
				metrics[`${name}.cutItems`] = plan.cuts.reduce((s, c) => s + c.cutIds.length, 0);
				days.push(...reportDays(name, input, plan));
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
		const report: SimReport = {
			scenario: SCENARIO,
			passed: error === undefined && allProblems.length === 0,
			seed: SEED,
			days,
			metrics,
			...(error === undefined ? {} : { error })
		};
		writeSimReport(report);
		if (error !== undefined) throw new Error(error);
		expect(allProblems).toEqual([]);
	});

	it('the generous week fits without cuts and the tight week is flagged', () => {
		// Scenario design check, from the work at full knobs.
		const total = weekCourses().reduce((s, c) => s + courseWork(c, FULL_KNOBS, PLAN_CTX), 0);
		expect(total).toBeLessThanOrEqual(AVAILABILITIES.generous![0]! * 2);
		expect(planDays(inputFor(AVAILABILITIES.generous!)).result.feasible).toBe(true);
		const tight = planDays(inputFor(AVAILABILITIES.tight!)).result;
		expect(tight.feasible).toBe(false);
		expect(tight.firstShort?.courseId).toBe(courseId(1));
		expect(tight.cuts.some((c) => c.degradations.length > 0)).toBe(true);
	});
});
