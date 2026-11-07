import type { CardId, Weight } from '#lib/db/schemas/common.ts';
import type { SessionPhase, SessionSnapshot } from '#lib/db/schemas/session.ts';
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
	void count;
	throw new Error('not implemented');
}

/**
 * Moves the head of the queue back so `lag` other cards come before it; a queue too short for the
 * lag gets it at the end.
 *
 * @see BUILD_PLAN §6.4
 */
export function reinsert(queue: readonly CardId[], lag: number): CardId[] {
	void queue;
	void lag;
	throw new Error('not implemented');
}

/** The card to show now, or null when the queue is empty. @see BUILD_PLAN §6.4 */
export function currentItem(state: SessionSnapshot): CurrentItem | null {
	void state;
	throw new Error('not implemented');
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
	void state;
	void answer;
	throw new Error('not implemented');
}
