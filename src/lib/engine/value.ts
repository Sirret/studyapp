import { PRIORITY_WEIGHT } from '#lib/config/defaults.ts';
import type { Priority } from '#lib/db/schemas/common.ts';

/**
 * The one value formula behind cram's degrade order, the planner's cuts and one-night triage:
 * what reviewing some cards before the exam is worth.
 *
 * @see BUILD_PLAN §6.6 (degrade), §6.8 (one-night), §6.9 (cuts) and Decisions log (Fix pass: valueOf)
 */

/** What is being valued: cards of one priority, with their recall at the exam (0 when new). */
export interface Valued {
	priority: Priority;
	rExam: number;
	/** How many such cards; 1 when absent. */
	cards?: number;
}

/** `PRIORITY_WEIGHT[priority] × max(0, retention − R_exam) × cards`. */
export function valueOf(item: Valued, retention: number): number {
	return PRIORITY_WEIGHT[item.priority] * Math.max(0, retention - item.rExam) * (item.cards ?? 1);
}

/**
 * Value per minute. Work that takes no time ranks above all timed work; the result stays finite,
 * so comparators that subtract two ratios never get `Infinity − Infinity`.
 */
export function valuePerMinute(item: Valued, retention: number, minutes: number): number {
	const value = valueOf(item, retention);
	if (minutes > 0) return value / minutes;
	return value > 0 ? Number.MAX_VALUE : 0;
}
