import type { CourseId } from '#lib/db/schemas/common.ts';
import type { CourseCuts, PlanCutsInput } from './planner-cuts.ts';
import type { DaySplit } from './planner-split.ts';
import type { ExamCheck } from './planner-work.ts';
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
	/** Every exam fits without cuts. */
	feasible: boolean;
	/** The first exam that doesn't fit, or `null`. */
	firstShort: { courseId: CourseId; examDay: number; shortfallMinutes: number } | null;
	/** Degrading and suggested cuts per course (input order). */
	cuts: CourseCuts[];
	/** The daily split from today, using the work after cuts. */
	days: DaySplit[];
}

/** Runs `demandCheck` at full work, `planCuts`, then `dailySplit` on the work after cuts. */
export function planDays(input: PlannerInput): Traced<PlannerResult> {
	void input;
	throw new Error('not implemented');
}
