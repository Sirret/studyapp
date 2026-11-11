import type { CourseId } from '#lib/db/schemas/common.ts';
import type { Traced } from './trace.ts';

/**
 * Splitting each day's minutes across the courses with exams ahead: a floor for every active
 * course, then blocks to the course with the least laxity.
 *
 * @see BUILD_PLAN §6.9 (daily split), CONCEPT §10 and Decisions log (Phase 8)
 */

/** One day of the split. */
export interface DaySplit {
	/** The study day. */
	day: number;
	/** Whole minutes per active course that got any; a course given nothing is left out. */
	minutes: Partial<Record<CourseId, number>>;
	/** The day's minutes nobody was given. */
	freeMinutes: number;
}

/**
 * Least-laxity-first, day by day from today to the day before the last exam. For day d, cap =
 * floor(`dayMinutes[d − today]`) (missing → 0); active = courses with exam day > d and remaining
 * work > 0. Each active course first gets min(`DAILY_FLOOR_MIN`, floor(cap / |active|), its
 * remaining). Then, while cap is left and an active course has work, a block of min(`BLOCK_MIN`,
 * cap left, its remaining) goes to the course with the least laxity, where laxity = cap left today
 * + Σ caps of the later days before its exam − its remaining work; ties to the earlier exam, then
 * course ID. Remaining work carries over to the next day.
 */
export function dailySplit(input: {
	courses: readonly { courseId: CourseId; examDay: number; workMinutes: number }[];
	today: number;
	dayMinutes: readonly number[];
}): Traced<DaySplit[]> {
	void input;
	throw new Error('not implemented');
}
