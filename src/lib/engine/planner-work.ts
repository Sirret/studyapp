import { PRIORITY_WEIGHT } from '#lib/config/defaults.ts';
import type { CourseId, Priority } from '#lib/db/schemas/common.ts';
import {
	cardMinutes,
	withMargin,
	type Calibration,
	type EstimateCard,
	type EstimateContext,
	type Standing
} from './estimate.ts';
import type { FsrsConfig } from './fsrs.ts';
import { compareText } from './replay.ts';
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
	/** The unit's learning minutes, without the safety margin (`courseWork` applies it once). */
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

/** Absorbs float noise before rounding work up (e.g. 6.000000000001 stays 6). */
const ROUNDING_EPSILON = 1e-9;

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

/** The estimate context of an item at the given knobs. */
function estimateContext(knobs: PlanKnobs, context: PlanEstimateContext): EstimateContext {
	return {
		criterion: knobs.criterion,
		relearnSessions: knobs.relearn,
		at: context.now,
		calibration: context.calibration,
		fsrs: context.fsrs
	};
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
	const estimate = estimateContext(knobs, context);
	switch (item.type) {
		case 'card':
			return cardMinutes(item.card, item.standing, estimate);
		case 'unit':
			return item.cards.reduce(
				(sum, card) => sum + cardMinutes(card, 'new', estimate),
				item.learnMinutes
			);
	}
}

/**
 * An item's value: `PRIORITY_WEIGHT[priority] × max(0, retention − R_exam)` for a card; for a
 * unit, `PRIORITY_WEIGHT[priority] × retention × its card count` (R_exam = 0).
 */
export function itemValue(item: PlanItem, retention: number): number {
	const weight = PRIORITY_WEIGHT[item.priority];
	switch (item.type) {
		case 'card':
			return weight * Math.max(0, retention - item.rExam);
		case 'unit':
			return weight * retention * item.cards.length;
	}
}

/**
 * A course's work in whole minutes: `ceil(Σ itemMinutes × SAFETY_MARGIN)` over the items not in
 * `cut`. Summed in item-ID order, so the float total doesn't depend on input order.
 */
export function courseWork(
	course: PlanCourse,
	knobs: PlanKnobs,
	context: PlanEstimateContext,
	cut: ReadonlySet<string> = new Set()
): number {
	const minutes = course.items
		.filter((item) => !cut.has(item.id))
		.sort((a, b) => compareText(a.id, b.id))
		.reduce((sum, item) => sum + itemMinutes(item, knobs, context), 0);
	// `max(0, …)` also turns ceil(−ε) = −0 into 0.
	return Math.max(0, Math.ceil(withMargin(minutes) - ROUNDING_EPSILON));
}

/** Whole available minutes of a day: floored, never negative, missing → 0. */
export function wholeMinutes(minutes: number | undefined): number {
	return Math.max(0, Math.floor(minutes ?? 0));
}

/** Exams in check order: exam day, then course ID. */
export function examOrder<T extends { courseId: CourseId; examDay: number }>(
	exams: readonly T[]
): T[] {
	return [...exams].sort((a, b) => a.examDay - b.examDay || compareText(a.courseId, b.courseId));
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
	let demand = 0;
	const checks = examOrder(input.exams).map((exam): ExamCheck => {
		demand += exam.workMinutes;
		let supply = wholeMinutes(input.examMorningMinutes);
		for (let day = input.today; day < exam.examDay; day++) {
			supply += wholeMinutes(input.dayMinutes[day - input.today]);
		}
		const shortfall = Math.max(0, demand - supply);
		return {
			courseId: exam.courseId,
			examDay: exam.examDay,
			demandMinutes: demand,
			supplyMinutes: supply,
			shortfallMinutes: shortfall,
			fits: shortfall === 0
		};
	});
	return {
		result: checks,
		trace: checks.map((check) => ({ rule: 'planner.demand', ...check }))
	};
}
