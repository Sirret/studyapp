import { CRITERION_FIRST, RELEARN_SESSIONS_MAX } from '#lib/config/defaults.ts';
import type { CourseId } from '#lib/db/schemas/common.ts';
import { planCuts, type CourseCuts, type PlanCutsInput } from './planner-cuts.ts';
import { dailySplit, type DaySplit } from './planner-split.ts';
import {
	courseWork,
	demandCheck,
	type ExamCheck,
	type PlanCourse,
	type PlanKnobs
} from './planner-work.ts';
import type { Traced } from './trace.ts';

export * from './planner-cuts.ts';
export * from './planner-split.ts';
export * from './planner-work.ts';

/**
 * The planner: shares the days' minutes across every course with an exam ahead. Re-derived from
 * the cards' state on every read (nothing stored), so each day's first open re-plans it.
 *
 * @see BUILD_PLAN §6.9, CONCEPT §10–§11 and Decisions log (Phase 8)
 */

export type PlannerInput = PlanCutsInput;

export interface PlannerResult {
	/** The processor-demand check before any cuts, in exam order. */
	checks: ExamCheck[];
	/**
	 * The same check on the work after degrading and cuts, in exam order: what is still short once
	 * the suggested cuts are made (Decisions "UX fix: one plan verdict").
	 */
	afterCuts: ExamCheck[];
	/** Every exam fits without cuts. */
	feasible: boolean;
	/** The first exam that doesn't fit, or `null`. */
	firstShort: { courseId: CourseId; examDay: number; shortfallMinutes: number } | null;
	/** Degrading and suggested cuts per course (input order). */
	cuts: CourseCuts[];
	/** The daily split from today, using the work after cuts. */
	days: DaySplit[];
}

/** `demandCheck` over every course with each course's work from `workOf`. */
function checkWith(
	input: PlannerInput,
	workOf: (course: PlanCourse) => number
): Traced<ExamCheck[]> {
	return demandCheck({
		today: input.today,
		dayMinutes: input.dayMinutes,
		examMorningMinutes: input.examMorningMinutes,
		exams: input.courses.map((course) => ({
			courseId: course.courseId,
			examDay: course.examDay,
			workMinutes: workOf(course)
		}))
	});
}

/**
 * Runs `demandCheck` at full work, `planCuts`, `demandCheck` again on the work after cuts
 * (`afterCuts`), then `dailySplit` on the work after cuts.
 */
export function planDays(input: PlannerInput): Traced<PlannerResult> {
	const full: PlanKnobs = { criterion: CRITERION_FIRST, relearn: RELEARN_SESSIONS_MAX };
	const checked = checkWith(input, (course) => courseWork(course, full, input));
	const cuts = planCuts(input);
	const cutWork = new Map(cuts.result.map((cut) => [cut.courseId, cut.workMinutes]));
	const afterCuts = checkWith(input, (course) => cutWork.get(course.courseId) ?? 0).result;
	const examDays = new Map(input.courses.map((course) => [course.courseId, course.examDay]));
	const split = dailySplit({
		today: input.today,
		dayMinutes: input.dayMinutes,
		courses: cuts.result.map((cut) => ({
			courseId: cut.courseId,
			examDay: examDays.get(cut.courseId) ?? input.today,
			workMinutes: cut.workMinutes
		}))
	});
	const short = checked.result.find((check) => !check.fits);
	const result: PlannerResult = {
		checks: checked.result,
		afterCuts,
		feasible: short === undefined,
		firstShort: short
			? {
					courseId: short.courseId,
					examDay: short.examDay,
					shortfallMinutes: short.shortfallMinutes
				}
			: null,
		cuts: cuts.result,
		days: split.result
	};
	const summary = {
		rule: 'planner.plan',
		feasible: result.feasible,
		firstShort: result.firstShort
	};
	return { result, trace: [...checked.trace, ...cuts.trace, ...split.trace, summary] };
}
