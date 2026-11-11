import type { CourseId } from '#lib/db/schemas/common.ts';
import type { Traced } from './trace.ts';
import type { PlanCourse, PlanEstimateContext, PlanKnobs } from './planner-work.ts';

/**
 * What to cut when the exams don't fit: the degrade order per failing deadline, then a greedy
 * knapsack by value per minute.
 *
 * @see BUILD_PLAN §6.9 (cuts), §6.6 (degrade order) and Decisions log (Phase 8)
 */

/** A degrade step the planner applied to a course, in this order. */
export type PlanDegradation = 'criterion' | 'relearning' | 'cut';

/** The cuts for one course. */
export interface CourseCuts {
	courseId: CourseId;
	knobs: PlanKnobs;
	/** Each step once, in the order first applied. */
	degradations: PlanDegradation[];
	/** Item IDs removed, in the order they were cut. */
	cutIds: string[];
	/** Work in whole minutes after the knobs and cuts. */
	workMinutes: number;
}

export interface PlanCutsInput extends PlanEstimateContext {
	courses: readonly PlanCourse[];
	today: number;
	/** Available minutes from today (index 0). */
	dayMinutes: readonly number[];
	examMorningMinutes: number;
	/** `R_target` in the value formula (Settings.retention). */
	retention: number;
}

/**
 * Starting from `CRITERION_FIRST` and `RELEARN_SESSIONS_MAX` for every course: for the first
 * exam (in `demandCheck` order) that doesn't fit, the courses whose exam day is on or before it
 * get criterion `CRITERION_FIRST_DEGRADED`, then K lowered by one at a time (all of them) to 1,
 * then their items removed lowest value per minute first (ties by course ID, then item ID) until
 * that exam fits; then the next exam that doesn't fit. Courses are returned in input order.
 */
export function planCuts(input: PlanCutsInput): Traced<CourseCuts[]> {
	void input;
	throw new Error('not implemented');
}
