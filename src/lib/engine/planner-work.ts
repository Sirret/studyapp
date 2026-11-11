import type { CourseId, Priority } from '#lib/db/schemas/common.ts';
import type { Calibration, EstimateCard, Standing } from './estimate.ts';
import type { FsrsConfig } from './fsrs.ts';
import type { Traced } from './trace.ts';

/**
 * The planner's work and feasibility: what each piece of work costs and is worth, the work per
 * course, and the processor-demand check across several exam dates.
 *
 * @see BUILD_PLAN §6.9, CONCEPT §10–§11 and Decisions log (Phase 8)
 */

/** A review card of a course with an exam ahead. */
export interface PlanCardItem {
	type: 'card';
	/** The card ID. */
	id: string;
	card: EstimateCard;
	standing: Standing;
	priority: Priority;
	/** Recall at exam time with no further review (`R_exam_without`); 0 for a new card. */
	rExam: number;
}

/**
 * An acquisition unit still to learn: its learning cost, plus its cards as `new` cards, since
 * the next-day retest is their first credited session.
 */
export interface PlanUnitItem {
	type: 'unit';
	/** The unit key. */
	id: string;
	/** The unit's learning minutes (`unitCost`, safety margin already applied). */
	learnMinutes: number;
	cards: EstimateCard[];
	priority: Priority;
}

export type PlanItem = PlanCardItem | PlanUnitItem;

/** A course with an exam on or after today. */
export interface PlanCourse {
	courseId: CourseId;
	/** The exam's study day. */
	examDay: number;
	items: PlanItem[];
}

/** The degrade knobs of a course (§6.6 degrade order). */
export interface PlanKnobs {
	/** Corrects a new card needs in its first session (k). */
	criterion: number;
	/** Relearning sessions per card (K). */
	relearn: number;
}

/** What the estimates need besides the items. */
export interface PlanEstimateContext {
	/** When planning happens (epoch ms), for `R(t)`. */
	now: number;
	calibration: Calibration;
	fsrs: FsrsConfig;
}

/** One exam's line of the processor-demand check. */
export interface ExamCheck {
	courseId: CourseId;
	examDay: number;
	/** Work of this exam and every exam sorted before it. */
	demandMinutes: number;
	/** Day minutes from today up to the day before this exam, plus the exam morning. */
	supplyMinutes: number;
	/** `max(0, demand − supply)`. */
	shortfallMinutes: number;
	fits: boolean;
}

/**
 * An item's minutes at the given knobs, safety margin not applied: a card `cardMinutes` for its
 * standing; a unit its `learnMinutes` + its cards as `new`.
 */
export function itemMinutes(
	item: PlanItem,
	knobs: PlanKnobs,
	context: PlanEstimateContext
): number {
	void item;
	void knobs;
	void context;
	throw new Error('not implemented');
}

/**
 * An item's value: `PRIORITY_WEIGHT[priority] × max(0, retention − R_exam)` for a card; for a
 * unit, `PRIORITY_WEIGHT[priority] × retention × its card count` (R_exam = 0).
 */
export function itemValue(item: PlanItem, retention: number): number {
	void item;
	void retention;
	throw new Error('not implemented');
}

/**
 * A course's work in whole minutes: `ceil(Σ itemMinutes × SAFETY_MARGIN)` over the items not in
 * `cut`.
 */
export function courseWork(
	course: PlanCourse,
	knobs: PlanKnobs,
	context: PlanEstimateContext,
	cut: ReadonlySet<string> = new Set()
): number {
	void course;
	void knobs;
	void context;
	void cut;
	throw new Error('not implemented');
}

/**
 * The processor-demand check (§6.9): exams sorted by exam day, then course ID; exam k fits when
 * Σ work of exams 1..k ≤ Σ `dayMinutes` for the days before its exam day + `examMorningMinutes`.
 * `dayMinutes[0]` is today (`today`); missing days count as 0; minutes are floored.
 */
export function demandCheck(input: {
	exams: readonly { courseId: CourseId; examDay: number; workMinutes: number }[];
	today: number;
	dayMinutes: readonly number[];
	examMorningMinutes: number;
}): Traced<ExamCheck[]> {
	void input;
	throw new Error('not implemented');
}
