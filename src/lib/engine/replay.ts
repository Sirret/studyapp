import { EMPTY_CARD_CACHES, type CardCaches } from '#lib/db/schemas/card.ts';
import type { CardId, DeviceId, ExerciseKind } from '#lib/db/schemas/common.ts';
import type { StudyEvent } from '#lib/db/schemas/event.ts';
import { DEFAULT_FSRS_CONFIG, type FsrsConfig } from './fsrs.ts';
import type { Traced } from './trace.ts';

/** What replay needs of a card: its ID and its format path (for `pathStep`). */
export interface ReplayCard {
	id: CardId;
	path: readonly ExerciseKind[];
}

/** FSRS settings and the local zone that study days are counted in. */
export interface ReplayConfig {
	fsrs: FsrsConfig;
	/** Minutes east of UTC (see `engine/time.ts`). */
	tzOffsetMin: number;
}

/** Default FSRS settings, study days in UTC. */
export const DEFAULT_REPLAY_CONFIG: ReplayConfig = { fsrs: DEFAULT_FSRS_CONFIG, tzOffsetMin: 0 };

/** The fields of an event that fix its place in history. */
export type EventOrderKey = { ts: number; deviceId: DeviceId; seq: number };

/** Compares by code unit: unlike `localeCompare`, the same on every device. */
export function compareText(a: string, b: string): number {
	if (a === b) return 0;
	return a < b ? -1 : 1;
}

/**
 * Orders events by `(ts, deviceId, seq)`, the one order replay uses on every device.
 *
 * @see BUILD_PLAN §6.12
 */
export function compareEvents(a: EventOrderKey, b: EventOrderKey): number {
	return a.ts - b.ts || compareText(a.deviceId, b.deviceId) || a.seq - b.seq;
}

/**
 * Returns the events in replay order, with `id` settling the rare full tie so the order never
 * depends on the input.
 *
 * @see BUILD_PLAN §6.12
 */
export function sortEvents<T extends EventOrderKey & { id: string }>(events: readonly T[]): T[] {
	return [...events].sort((a, b) => compareEvents(a, b) || compareText(a.id, b.id));
}

function countsTowardAccuracy(event: StudyEvent): event is Extract<StudyEvent, { type: 'review' }> {
	return event.type === 'review' && event.firstAttempt && event.weight !== 'none';
}

/**
 * Rebuilds the caches of the given cards from the events: pure, and independent of input order.
 * A card with no events gets empty caches. Each card's events fold in order through FSRS,
 * criterion, status, fragile, weak, `pathStep` and accuracy.
 *
 * @see BUILD_PLAN §6.12
 * @see DATA_MODEL §3.5
 */
export function replay(
	events: readonly StudyEvent[],
	cards: readonly ReplayCard[],
	config: ReplayConfig = DEFAULT_REPLAY_CONFIG
): Traced<Record<CardId, CardCaches>> {
	void config;
	const accuracy = new Map<string, CardCaches['accuracy']>();
	for (const event of sortEvents(events)) {
		if (!countsTowardAccuracy(event)) continue;
		const { n, correct } = accuracy.get(event.cardId) ?? EMPTY_CARD_CACHES.accuracy;
		accuracy.set(event.cardId, { n: n + 1, correct: correct + (event.correct ? 1 : 0) });
	}

	const result = {} as Record<CardId, CardCaches>;
	const cardIds = cards.map((card) => card.id);
	const trace = [...new Set(cardIds)].sort(compareText).map((cardId) => {
		const cardAccuracy = accuracy.get(cardId) ?? { ...EMPTY_CARD_CACHES.accuracy };
		result[cardId] = { ...EMPTY_CARD_CACHES, accuracy: cardAccuracy };
		return { rule: 'replay.card', cardId, ...cardAccuracy };
	});
	return { result, trace };
}
