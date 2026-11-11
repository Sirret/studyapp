import {
	CRITERION_FIRST,
	CRITERION_FIRST_DEGRADED,
	RELEARN_SESSIONS_MAX
} from '#lib/config/defaults.ts';
import type { CourseId } from '#lib/db/schemas/common.ts';
import {
	courseWork,
	demandCheck,
	itemMinutes,
	itemValue,
	type PlanCourse,
	type PlanEstimateContext,
	type PlanKnobs
} from './planner-work.ts';
import { compareText } from './replay.ts';
import type { Traced, TraceEntry } from './trace.ts';

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

/** A course's state while cutting. */
interface Working {
	course: PlanCourse;
	knobs: PlanKnobs;
	degradations: PlanDegradation[];
	cut: string[];
	work: number;
}

function rework(entry: Working, input: PlanCutsInput): void {
	entry.work = courseWork(entry.course, entry.knobs, input, new Set(entry.cut));
}

function degradeOnce(entry: Working, step: PlanDegradation): void {
	if (!entry.degradations.includes(step)) entry.degradations.push(step);
}

/** Whether exam `index` (in check order) fits at the current work. */
function fitsAt(ordered: readonly Working[], index: number, input: PlanCutsInput): boolean {
	const checks = demandCheck({
		exams: ordered.map((entry) => ({
			courseId: entry.course.courseId,
			examDay: entry.course.examDay,
			workMinutes: entry.work
		})),
		today: input.today,
		dayMinutes: input.dayMinutes,
		examMorningMinutes: input.examMorningMinutes
	}).result;
	return checks[index]?.fits ?? true;
}

interface Candidate {
	entry: Working;
	id: string;
	ratio: number;
}

/** The items still in `scope`, lowest value per minute first; ties by course ID, then item ID. */
function cutOrder(scope: readonly Working[], input: PlanCutsInput): Candidate[] {
	const candidates = scope.flatMap((entry) => {
		const cut = new Set(entry.cut);
		return entry.course.items
			.filter((item) => !cut.has(item.id))
			.map((item) => ({
				entry,
				id: item.id,
				ratio:
					itemValue(item, input.retention) /
					Math.max(itemMinutes(item, entry.knobs, input), Number.MIN_VALUE)
			}));
	});
	return candidates.sort(
		(a, b) =>
			a.ratio - b.ratio ||
			compareText(a.entry.course.courseId, b.entry.course.courseId) ||
			compareText(a.id, b.id)
	);
}

/** Cuts the first `count` candidates (on top of earlier cuts) and reworks their courses. */
function cutFirst(
	scope: readonly Working[],
	base: ReadonlyMap<Working, string[]>,
	order: readonly Candidate[],
	count: number,
	input: PlanCutsInput
): void {
	for (const entry of scope) entry.cut = [...(base.get(entry) ?? [])];
	for (const candidate of order.slice(0, count)) candidate.entry.cut.push(candidate.id);
	for (const entry of scope) rework(entry, input);
}

/**
 * Removes the fewest lowest-ratio items so exam `index` fits: the same result as cutting one at a
 * time, found by binary search (work only falls as more is cut).
 */
function cutUntilFits(
	ordered: readonly Working[],
	scope: readonly Working[],
	index: number,
	input: PlanCutsInput
): void {
	const order = cutOrder(scope, input);
	const base = new Map(scope.map((entry) => [entry, [...entry.cut]]));
	let low = 0;
	let high = order.length;
	while (low < high) {
		const mid = Math.floor((low + high) / 2);
		cutFirst(scope, base, order, mid, input);
		if (fitsAt(ordered, index, input)) high = mid;
		else low = mid + 1;
	}
	cutFirst(scope, base, order, low, input);
	for (const candidate of order.slice(0, low)) degradeOnce(candidate.entry, 'cut');
}

/** Degrades and cuts the courses due by exam `index` until it fits. */
function fixDeadline(
	ordered: readonly Working[],
	index: number,
	input: PlanCutsInput,
	trace: TraceEntry[]
): void {
	const examDay = ordered[index]?.course.examDay ?? input.today;
	const scope = ordered.filter((entry) => entry.course.examDay <= examDay);
	const apply = (step: PlanDegradation, change: (knobs: PlanKnobs) => PlanKnobs | null): void => {
		for (const entry of scope) {
			const next = change(entry.knobs);
			if (next === null) continue;
			entry.knobs = next;
			degradeOnce(entry, step);
			rework(entry, input);
		}
	};
	apply('criterion', (knobs) =>
		knobs.criterion > CRITERION_FIRST_DEGRADED
			? { ...knobs, criterion: CRITERION_FIRST_DEGRADED }
			: null
	);
	while (!fitsAt(ordered, index, input) && scope.some((entry) => entry.knobs.relearn > 1)) {
		apply('relearning', (knobs) =>
			knobs.relearn > 1 ? { ...knobs, relearn: knobs.relearn - 1 } : null
		);
	}
	if (!fitsAt(ordered, index, input)) cutUntilFits(ordered, scope, index, input);
	trace.push({
		rule: 'planner.cuts',
		courseId: ordered[index]?.course.courseId,
		examDay,
		knobs: scope.map((entry) => ({ courseId: entry.course.courseId, ...entry.knobs })),
		cut: scope.reduce((sum, entry) => sum + entry.cut.length, 0)
	});
}

/**
 * Starting from `CRITERION_FIRST` and `RELEARN_SESSIONS_MAX` for every course: for the first
 * exam (in `demandCheck` order) that doesn't fit, the courses whose exam day is on or before it
 * get criterion `CRITERION_FIRST_DEGRADED`, then K lowered by one at a time (all of them) to 1,
 * then their items removed lowest value per minute first (ties by course ID, then item ID) until
 * that exam fits; then the next exam that doesn't fit. Courses are returned in input order.
 */
export function planCuts(input: PlanCutsInput): Traced<CourseCuts[]> {
	const working: Working[] = input.courses.map((course) => {
		const entry: Working = {
			course,
			knobs: { criterion: CRITERION_FIRST, relearn: RELEARN_SESSIONS_MAX },
			degradations: [],
			cut: [],
			work: 0
		};
		rework(entry, input);
		return entry;
	});
	const ordered = [...working].sort(
		(a, b) =>
			a.course.examDay - b.course.examDay || compareText(a.course.courseId, b.course.courseId)
	);
	const trace: TraceEntry[] = [];
	ordered.forEach((_, index) => {
		if (!fitsAt(ordered, index, input)) fixDeadline(ordered, index, input, trace);
	});
	const result = working.map((entry): CourseCuts => ({
		courseId: entry.course.courseId,
		knobs: entry.knobs,
		degradations: entry.degradations,
		cutIds: entry.cut,
		workMinutes: entry.work
	}));
	return { result, trace };
}
