import type { CardCaches } from '#lib/db/schemas/card.ts';
import type { CardId, DeviceId } from '#lib/db/schemas/common.ts';
import type { StudyEvent } from '#lib/db/schemas/event.ts';
import type { Traced } from './trace.ts';

/** The fields of an event that fix its place in history. */
export type EventOrderKey = { ts: number; deviceId: DeviceId; seq: number };

/**
 * Orders events by `(ts, deviceId, seq)`, the one order replay uses on every device.
 *
 * @see BUILD_PLAN §6.12
 */
export function compareEvents(_a: EventOrderKey, _b: EventOrderKey): number {
	throw new Error('not implemented');
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
	_events: readonly StudyEvent[],
	_cardIds: readonly CardId[]
): Traced<Record<CardId, CardCaches>> {
	throw new Error('not implemented');
}
