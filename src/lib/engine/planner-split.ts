import { BLOCK_MIN, DAILY_FLOOR_MIN } from '#lib/config/defaults.ts';
import type { CourseId } from '#lib/db/schemas/common.ts';
import { wholeMinutes } from './planner-work.ts';
import { compareText } from './replay.ts';
import type { Traced, TraceEntry } from './trace.ts';

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
	const courses = [...input.courses].sort(
		(a, b) => a.examDay - b.examDay || compareText(a.courseId, b.courseId)
	);
	const remaining = new Map(courses.map((c) => [c.courseId, Math.max(0, c.workMinutes)]));
	const capOf = (day: number): number => wholeMinutes(input.dayMinutes[day - input.today]);
	const lastExam = Math.max(input.today, ...courses.map((c) => c.examDay));
	const days: DaySplit[] = [];
	const trace: TraceEntry[] = [];
	for (let day = input.today; day < lastExam; day++) {
		const split = splitDay({ day, cap: capOf(day), courses, remaining, capOf });
		days.push(split);
		trace.push({ rule: 'planner.split', ...split });
	}
	return { result: days, trace };
}

interface DayInput {
	day: number;
	cap: number;
	courses: readonly { courseId: CourseId; examDay: number }[];
	remaining: Map<CourseId, number>;
	capOf: (day: number) => number;
}

/** One day: floors first, then blocks to the least laxity. Updates `remaining`. */
function splitDay(input: DayInput): DaySplit {
	const { day, courses, remaining } = input;
	const minutes: Partial<Record<CourseId, number>> = {};
	let left = input.cap;
	const give = (courseId: CourseId, amount: number): void => {
		if (amount <= 0) return;
		minutes[courseId] = (minutes[courseId] ?? 0) + amount;
		remaining.set(courseId, (remaining.get(courseId) ?? 0) - amount);
		left -= amount;
	};
	const active = () =>
		courses.filter((c) => c.examDay > day && (remaining.get(c.courseId) ?? 0) > 0);
	const starting = active();
	const floor = Math.min(DAILY_FLOOR_MIN, Math.floor(input.cap / Math.max(1, starting.length)));
	for (const course of starting)
		give(course.courseId, Math.min(floor, remaining.get(course.courseId) ?? 0));
	for (let open = active(); left > 0 && open.length > 0; open = active()) {
		const laxity = (c: { courseId: CourseId; examDay: number }): number => {
			let later = 0;
			for (let d = day + 1; d < c.examDay; d++) later += input.capOf(d);
			return left + later - (remaining.get(c.courseId) ?? 0);
		};
		// `open` is in exam-day, then ID order, so the first of equal laxity wins the tie.
		const next = open.reduce((best, c) => (laxity(c) < laxity(best) ? c : best));
		give(next.courseId, Math.min(BLOCK_MIN, left, remaining.get(next.courseId) ?? 0));
	}
	return { day, minutes, freeMinutes: left };
}
