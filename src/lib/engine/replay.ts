import { EMPTY_CARD_CACHES, type CardCaches } from '#lib/db/schemas/card.ts';
import type { CardId, DeviceId } from '#lib/db/schemas/common.ts';
import type { StudyEvent } from '#lib/db/schemas/event.ts';
import type { Traced } from './trace.ts';

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
 * A card with no events gets empty caches. This skeleton derives `accuracy` (first-attempt review
 * events that are not `weight: 'none'`); Phase 4 adds FSRS, criterion, status and fragile.
 *
 * @see BUILD_PLAN §6.12
 * @see DATA_MODEL §3.5
 */
export function replay(
	events: readonly StudyEvent[],
	cardIds: readonly CardId[]
): Traced<Record<CardId, CardCaches>> {
	const accuracy = new Map<string, CardCaches['accuracy']>();
	for (const event of sortEvents(events)) {
		if (!countsTowardAccuracy(event)) continue;
		const { n, correct } = accuracy.get(event.cardId) ?? EMPTY_CARD_CACHES.accuracy;
		accuracy.set(event.cardId, { n: n + 1, correct: correct + (event.correct ? 1 : 0) });
	}

	const result = {} as Record<CardId, CardCaches>;
	const trace = [...new Set(cardIds)].sort(compareText).map((cardId) => {
		const cardAccuracy = accuracy.get(cardId) ?? { ...EMPTY_CARD_CACHES.accuracy };
		result[cardId] = { ...EMPTY_CARD_CACHES, accuracy: cardAccuracy };
		return { rule: 'replay.card', cardId, ...cardAccuracy };
	});
	return { result, trace };
}
