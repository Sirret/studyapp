import type { Weight } from '#lib/db/schemas/common.ts';
import type { Traced } from './trace.ts';

/** The parts of a review answer the criterion looks at. */
export interface CountableAnswer {
	firstAttempt: boolean;
	credited: boolean;
	weight: Weight;
	correct: boolean;
}

/** One card's progress toward its criterion within one session. */
export interface CriterionState {
	/** Counting corrects needed this session. */
	required: number;
	/** Counting corrects so far; a wrong counting answer resets it to 0. */
	count: number;
	/** Whether the last counting correct was `weight: 'full'`. */
	lastFull: boolean;
	/** Whether a counting answer was wrong this session. */
	failed: boolean;
}

/**
 * Whether an answer counts: a credited first attempt with `weight` `full` or `recognition`.
 *
 * @see BUILD_PLAN §6.3 and Decisions log (counting event)
 */
export function isCounting(answer: Omit<CountableAnswer, 'correct'>): boolean {
	void answer;
	throw new Error('not implemented');
}

/**
 * Corrects a card needs in a session: `CRITERION_FIRST` until it has met the criterion in some
 * credited session, then `CRITERION_LATER`.
 *
 * @see BUILD_PLAN §6.3 and Decisions log (required corrects)
 */
export function requiredCorrects(hasMetCriterion: boolean): number {
	void hasMetCriterion;
	throw new Error('not implemented');
}

/** A card's state at the start of a session. @see BUILD_PLAN §6.3 */
export function startCriterion(required: number): CriterionState {
	void required;
	throw new Error('not implemented');
}

/**
 * Folds one answer in. Non-counting answers leave the state unchanged; a counting correct adds one
 * and records its weight; a counting wrong resets the count and marks the card failed.
 *
 * @see BUILD_PLAN §6.3
 */
export function stepCriterion(state: CriterionState, answer: CountableAnswer): CriterionState {
	void state;
	void answer;
	throw new Error('not implemented');
}

/**
 * Met when the count reaches `required` and the last counting correct was full-weight.
 *
 * @see BUILD_PLAN §6.3 (recall-weighted)
 */
export function isCriterionMet(state: CriterionState): boolean {
	void state;
	throw new Error('not implemented');
}

/**
 * Folds one card's answers from one session, in order, and says whether the criterion was met at
 * any point.
 *
 * @see BUILD_PLAN §6.3
 */
export function criterionForSession(
	answers: readonly CountableAnswer[],
	required: number
): Traced<CriterionState & { met: boolean }> {
	void answers;
	void required;
	throw new Error('not implemented');
}
