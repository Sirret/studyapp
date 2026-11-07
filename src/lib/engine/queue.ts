import { CRITERION_FIRST_REDUCED, ERROR_LAG, LAGS } from '#lib/config/defaults.ts';
import type { CardId, Weight } from '#lib/db/schemas/common.ts';
import type { SessionCard, SessionPhase, SessionSnapshot } from '#lib/db/schemas/session.ts';
import { isCriterionMet, stepCriterion } from './criterion.ts';
import type { Traced } from './trace.ts';

/** What the session runner shows next. @see BUILD_PLAN §6.4 */
export interface CurrentItem {
	cardId: CardId;
	/** Seed part: options derive from `rngFor(cardId, sessionId, attempt)`. */
	attempt: number;
	/** False while the card is being cleared after a wrong answer (redo-till-right). */
	firstAttempt: boolean;
	phase: SessionPhase;
	/** Counting corrects so far this session, for the progress dots. */
	count: number;
	/** Counting corrects needed this session, for the progress dots. */
	required: number;
}

/**
 * An answer to the current card. The queue counts by weight (`full` or `recognition`); whether a
 * session is credited only matters to replay. @see BUILD_PLAN §6.4
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

/**
 * The card to show now, or null when the round's queue is empty or the round has ended.
 *
 * @see BUILD_PLAN §6.4
 */
export function currentItem(state: SessionSnapshot): CurrentItem | null {
	const cardId = state.queue[0];
	if (cardId === undefined || state.round.ended) return null;
	const card = cardOf(state, cardId);
	return {
		cardId,
		attempt: card.attempt,
		firstAttempt: state.clearing !== cardId,
		phase: card.phase,
		count: card.count,
		required: card.required
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

/** Steps the criterion; a first-ever correct counting answer first lowers `required`. */
function stepCard(card: SessionCard, answer: QueueAnswer): SessionCard {
	const { correct, weight } = answer;
	const stepped = {
		...card,
		...stepCriterion(card, { firstAttempt: true, credited: true, weight, correct })
	};
	if (!card.firstEver) return stepped;
	const known = correct && weight !== 'none';
	const required = known ? Math.min(card.required, CRITERION_FIRST_REDUCED) : card.required;
	return { ...stepped, firstEver: false, required };
}

function answerFirst(
	state: SessionSnapshot,
	card: SessionCard,
	answer: QueueAnswer
): [SessionSnapshot, Outcome] {
	const { cardId } = answer;
	const rest = state.queue.slice(1);
	const next = stepCard(card, answer);
	if (answer.weight === 'none') {
		return [withCard(state, cardId, { ...next, done: true }, { queue: rest }), 'done'];
	}
	if (!answer.correct) return [withCard(state, cardId, next, { clearing: cardId }), 'clearing'];
	if (isCriterionMet(next)) {
		return [withCard(state, cardId, { ...next, done: true }, { queue: rest }), 'done'];
	}
	const queue = reinsert(state.queue, lagAfterCorrect(next.count));
	return [withCard(state, cardId, next, { queue }), 'reinserted'];
}

/**
 * Applies an answer to the current card and returns the next snapshot.
 *
 * - First attempt, `none` weight: the card is done and leaves the queue.
 * - First attempt, correct: count + 1; done when the criterion is met, else reinserted at
 *   `lagAfterCorrect(count)` within the round's queue.
 * - First attempt, wrong: count reset, `failed`, and the card stays at the head as `clearing`.
 * - Clearing, correct: reinserted at `ERROR_LAG`. Clearing, wrong: stays at the head.
 * - The card's first attempt ever (`firstEver`): afterwards `firstEver` is false, and if it was a
 *   correct `full` or `recognition` answer, `required` drops to at most `CRITERION_FIRST_REDUCED`
 *   before the criterion is checked.
 *
 * Every answer increments the card's `attempt` and the round's `answers`. Throws if
 * `answer.cardId` isn't the current card or the round has ended, which is a bug in the caller.
 *
 * @see BUILD_PLAN §6.3, §6.4 and Decisions log (lags, redo-till-right, adaptive criterion)
 */
export function applyAnswer(state: SessionSnapshot, answer: QueueAnswer): Traced<SessionSnapshot> {
	if (state.round.ended) throw new Error('The round has ended');
	if (state.queue[0] !== answer.cardId) {
		throw new Error(`Card ${answer.cardId} is not the current card`);
	}
	const card = cardOf(state, answer.cardId);
	const attempted = { ...card, attempt: card.attempt + 1 };
	const [answered, outcome] =
		state.clearing === answer.cardId
			? answerClearing(state, attempted, answer)
			: answerFirst(state, attempted, answer);
	const result = { ...answered, round: { ...answered.round, answers: answered.round.answers + 1 } };
	const { cardId, correct } = answer;
	const position = result.queue.indexOf(cardId);
	return { result, trace: [{ rule: 'queue.answer', cardId, correct, outcome, position }] };
}
