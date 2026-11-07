import { ERROR_LAG, LAGS } from '#lib/config/defaults.ts';
import type { CardId, Weight } from '#lib/db/schemas/common.ts';
import type { SessionCard, SessionPhase, SessionSnapshot } from '#lib/db/schemas/session.ts';
import { isCriterionMet, stepCriterion } from './criterion.ts';
import type { Traced } from './trace.ts';

/** What the session runner shows next. */
export interface CurrentItem {
	cardId: CardId;
	/** Seed part: options derive from `rngFor(cardId, sessionId, attempt)`. */
	attempt: number;
	/** False while the card is being cleared after a wrong answer (redo-till-right). */
	firstAttempt: boolean;
	phase: SessionPhase;
}

/**
 * An answer to the current card. The queue counts by weight (`full` or `recognition`); whether a
 * session is credited only matters to replay.
 */
export interface QueueAnswer {
	cardId: CardId;
	correct: boolean;
	weight: Weight;
}

/**
 * Lag after a correct that doesn't finish the card: `LAGS[min(count, LAGS.length) − 1]`.
 *
 * @see BUILD_PLAN §6.4 and Decisions log (lags)
 */
export function lagAfterCorrect(count: number): number {
	const index = Math.min(Math.max(count, 1), LAGS.length) - 1;
	return LAGS[index] as number;
}

/**
 * Moves the head of the queue back so `lag` other cards come before it; a queue too short for the
 * lag gets it at the end.
 *
 * @see BUILD_PLAN §6.4
 */
export function reinsert(queue: readonly CardId[], lag: number): CardId[] {
	const [head, ...rest] = queue;
	if (head === undefined) return [];
	const at = Math.min(Math.max(lag, 0), rest.length);
	return [...rest.slice(0, at), head, ...rest.slice(at)];
}

/** The card to show now, or null when the queue is empty. @see BUILD_PLAN §6.4 */
export function currentItem(state: SessionSnapshot): CurrentItem | null {
	const cardId = state.queue[0];
	if (cardId === undefined) return null;
	const card = cardOf(state, cardId);
	return {
		cardId,
		attempt: card.attempt,
		firstAttempt: state.clearing !== cardId,
		phase: card.phase
	};
}

function cardOf(state: SessionSnapshot, cardId: CardId): SessionCard {
	const card = state.cards[cardId];
	if (!card) throw new Error(`Session has no state for card ${cardId}`);
	return card;
}

type Outcome = 'done' | 'reinserted' | 'clearing' | 'cleared' | 'still-clearing';

function withCard(
	state: SessionSnapshot,
	cardId: CardId,
	card: SessionCard,
	changes: Partial<Pick<SessionSnapshot, 'queue' | 'clearing'>>
): SessionSnapshot {
	return { ...state, ...changes, cards: { ...state.cards, [cardId]: card } };
}

function answerClearing(
	state: SessionSnapshot,
	card: SessionCard,
	answer: QueueAnswer
): [SessionSnapshot, Outcome] {
	if (!answer.correct) return [withCard(state, answer.cardId, card, {}), 'still-clearing'];
	const queue = reinsert(state.queue, ERROR_LAG);
	return [withCard(state, answer.cardId, card, { queue, clearing: null }), 'cleared'];
}

function answerFirst(
	state: SessionSnapshot,
	card: SessionCard,
	answer: QueueAnswer
): [SessionSnapshot, Outcome] {
	const { cardId, correct, weight } = answer;
	const rest = state.queue.slice(1);
	if (weight === 'none')
		return [withCard(state, cardId, { ...card, done: true }, { queue: rest }), 'done'];
	const next = {
		...card,
		...stepCriterion(card, { firstAttempt: true, credited: true, weight, correct })
	};
	if (!correct) return [withCard(state, cardId, next, { clearing: cardId }), 'clearing'];
	if (isCriterionMet(next))
		return [withCard(state, cardId, { ...next, done: true }, { queue: rest }), 'done'];
	const queue = reinsert(state.queue, lagAfterCorrect(next.count));
	return [withCard(state, cardId, next, { queue }), 'reinserted'];
}

/**
 * Applies an answer to the current card and returns the next snapshot.
 *
 * - First attempt, `none` weight: the card is done and leaves the queue.
 * - First attempt, correct: count + 1; done when the criterion is met, else reinserted at
 *   `lagAfterCorrect(count)`.
 * - First attempt, wrong: count reset, `failed`, and the card stays at the head as `clearing`.
 * - Clearing, correct: reinserted at `ERROR_LAG`. Clearing, wrong: stays at the head.
 *
 * Every answer increments the card's `attempt`. Throws if `answer.cardId` isn't the current card,
 * which is a bug in the caller.
 *
 * @see BUILD_PLAN §6.3, §6.4 and Decisions log (lags, redo-till-right)
 */
export function applyAnswer(state: SessionSnapshot, answer: QueueAnswer): Traced<SessionSnapshot> {
	if (state.queue[0] !== answer.cardId) {
		throw new Error(`Card ${answer.cardId} is not the current card`);
	}
	const card = cardOf(state, answer.cardId);
	const attempted = { ...card, attempt: card.attempt + 1 };
	const [result, outcome] =
		state.clearing === answer.cardId
			? answerClearing(state, attempted, answer)
			: answerFirst(state, attempted, answer);
	const position = result.queue.indexOf(answer.cardId);
	return {
		result,
		trace: [
			{ rule: 'queue.answer', cardId: answer.cardId, correct: answer.correct, outcome, position }
		]
	};
}
