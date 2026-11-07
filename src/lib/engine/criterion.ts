import { CRITERION_FIRST, CRITERION_LATER } from '#lib/config/defaults.ts';
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
	return answer.firstAttempt && answer.credited && answer.weight !== 'none';
}

/**
 * Corrects a card needs in a session: `CRITERION_FIRST` until it has met the criterion in some
 * credited session, then `CRITERION_LATER`.
 *
 * @see BUILD_PLAN §6.3 and Decisions log (required corrects)
 */
export function requiredCorrects(hasMetCriterion: boolean): number {
	return hasMetCriterion ? CRITERION_LATER : CRITERION_FIRST;
}

/** A card's state at the start of a session. @see BUILD_PLAN §6.3 */
export function startCriterion(required: number): CriterionState {
	return { required, count: 0, lastFull: false, failed: false };
}

/**
 * Folds one answer in. Non-counting answers leave the state unchanged; a counting correct adds one
 * and records its weight; a counting wrong resets the count and marks the card failed.
 *
 * @see BUILD_PLAN §6.3
 */
export function stepCriterion(state: CriterionState, answer: CountableAnswer): CriterionState {
	if (!isCounting(answer)) return state;
	if (!answer.correct) return { ...state, count: 0, lastFull: false, failed: true };
	return { ...state, count: state.count + 1, lastFull: answer.weight === 'full' };
}

/**
 * Met when the count reaches `required` and the last counting correct was full-weight.
 *
 * @see BUILD_PLAN §6.3 (recall-weighted)
 */
export function isCriterionMet(state: CriterionState): boolean {
	return state.count >= state.required && state.lastFull;
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
	let state = startCriterion(required);
	let met = false;
	for (const answer of answers) {
		state = stepCriterion(state, answer);
		met ||= isCriterionMet(state);
	}
	return {
		result: { ...state, met },
		trace: [{ rule: 'criterion.session', required, count: state.count, met }]
	};
}

/**
 * Whether a card has met its criterion in some credited session, from its answers in replay
 * order. Each session needs `requiredCorrects` of what came before it, exactly as replay counts.
 *
 * @see BUILD_PLAN §6.3 and Decisions log (required corrects)
 */
export function hasMetCriterion(
	answers: readonly (CountableAnswer & { sessionId: string })[]
): boolean {
	const bySession = new Map<string, CountableAnswer[]>();
	for (const answer of answers) {
		if (!isCounting(answer)) continue;
		const list = bySession.get(answer.sessionId);
		if (list) list.push(answer);
		else bySession.set(answer.sessionId, [answer]);
	}
	let met = false;
	for (const sessionAnswers of bySession.values()) {
		met ||= criterionForSession(sessionAnswers, requiredCorrects(met)).result.met;
	}
	return met;
}
