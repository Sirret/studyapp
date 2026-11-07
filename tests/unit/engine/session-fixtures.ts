import type { CardId, ExerciseKind, Weight } from '#lib/db/schemas/common.ts';
import type { SessionCard, SessionSnapshot } from '#lib/db/schemas/session.ts';
import type { CountableAnswer } from '#lib/engine/criterion.ts';
import type { QueueAnswer } from '#lib/engine/queue.ts';
import type { PlanCard } from '#lib/engine/session.ts';
import { cardId, noteId } from './fixtures.ts';

/** A fresh session card in `recall`, needing one counting correct. */
export function makeSessionCard(overrides: Partial<SessionCard> = {}): SessionCard {
	return {
		phase: 'recall',
		required: 1,
		count: 0,
		lastFull: false,
		failed: false,
		attempt: 0,
		done: false,
		...overrides
	};
}

/**
 * A snapshot whose queue is `queue`; every queued card gets `makeSessionCard()` unless `cards`
 * overrides it. Extra entries in `cards` (e.g. done cards) are kept.
 */
export function makeSnapshot(
	queue: readonly CardId[],
	cards: Readonly<Record<string, Partial<SessionCard>>> = {},
	rest: Partial<Pick<SessionSnapshot, 'clearing' | 'cleanup'>> = {}
): SessionSnapshot {
	const all: Record<string, SessionCard> = {};
	for (const id of queue) all[id] = makeSessionCard(cards[id]);
	for (const [id, card] of Object.entries(cards)) all[id] ??= makeSessionCard(card);
	return { queue: [...queue], cards: all, clearing: null, cleanup: false, ...rest };
}

/** `count` card IDs starting at `from`, e.g. the "other" cards of a queue. */
export function cardRange(from: number, count: number): CardId[] {
	return Array.from({ length: count }, (_, i) => cardId(from + i));
}

/** A queue answer. */
export function qa(id: CardId, correct: boolean, weight: Weight = 'full'): QueueAnswer {
	return { cardId: id, correct, weight };
}

/** A counting answer by default: credited, first attempt, full weight, correct. */
export function ca(overrides: Partial<CountableAnswer> = {}): CountableAnswer {
	return { firstAttempt: true, credited: true, weight: 'full', correct: true, ...overrides };
}

/** A plan card: card `n` of note `n`, a keyterm, not new, needing one correct. */
export function planCard(
	n: number,
	kind: ExerciseKind,
	overrides: Partial<PlanCard> = {}
): PlanCard {
	return {
		id: cardId(n),
		noteId: noteId(n),
		noteType: 'keyterm',
		kind,
		isNew: false,
		required: 1,
		...overrides
	};
}

/** `items[i]`, throwing instead of returning undefined (for `noUncheckedIndexedAccess`). */
export function at<T>(items: readonly T[], i: number): T {
	const item = items[i];
	if (item === undefined) throw new Error(`no item at ${i}`);
	return item;
}

/** The session card for `id`, throwing if it's missing. */
export function cardOf(state: SessionSnapshot, id: CardId): SessionCard {
	const card = state.cards[id];
	if (card === undefined) throw new Error(`no session card for ${id}`);
	return card;
}
