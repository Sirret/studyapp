import type { CardId, ExerciseKind, Weight } from '#lib/db/schemas/common.ts';
import type { SessionCard, SessionRound, SessionSnapshot } from '#lib/db/schemas/session.ts';
import type { CountableAnswer } from '#lib/engine/criterion.ts';
import type { QueueAnswer } from '#lib/engine/queue.ts';
import type { PlanCard } from '#lib/engine/session.ts';
import { MS_PER_DAY } from '#lib/engine/time.ts';
import { cardId, noteId } from './fixtures.ts';

/** When fixture sessions and their first round start. */
export const T0 = 1_700_000_000_000;
/** One minute in ms, derived from the engine's day length. */
export const MINUTE = MS_PER_DAY / (24 * 60);

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
		firstEver: false,
		...overrides
	};
}

/** Extra snapshot fields for `makeSnapshot`; `round` is merged into the default round. */
export type SnapshotRest = Partial<Omit<SessionSnapshot, 'queue' | 'cards' | 'round'>> & {
	round?: Partial<SessionRound>;
};

/**
 * A snapshot whose round queue is `queue`; every queued or backlog card gets `makeSessionCard()`
 * unless `cards` overrides it. Extra entries in `cards` (e.g. done cards) are kept. The round is
 * round 1, started at `T0` with no answers, holding `queue`; `studySince` is `T0`.
 */
export function makeSnapshot(
	queue: readonly CardId[],
	cards: Readonly<Record<string, Partial<SessionCard>>> = {},
	rest: SnapshotRest = {}
): SessionSnapshot {
	const { round, ...others } = rest;
	const backlog = others.backlog ?? [];
	const all: Record<string, SessionCard> = {};
	for (const id of [...queue, ...backlog]) all[id] ??= makeSessionCard(cards[id]);
	for (const [id, card] of Object.entries(cards)) all[id] ??= makeSessionCard(card);
	return {
		clearing: null,
		cleanup: false,
		studySince: T0,
		...others,
		queue: [...queue],
		backlog: [...backlog],
		cards: all,
		round: { index: 1, startedAt: T0, answers: 0, cards: [...queue], ended: false, ...round }
	};
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

/** A plan card: card `n` of note `n`, a keyterm, not new, not first-ever, needing one correct. */
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
		firstEver: false,
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
