import type { CardCaches } from '#lib/db/schemas/card.ts';
import type { CardId, DeviceId, ExerciseKind } from '#lib/db/schemas/common.ts';
import type { StudyEvent } from '#lib/db/schemas/event.ts';
import { DEFAULT_FSRS_CONFIG, type FsrsConfig } from './fsrs.ts';
import { replayCard } from './replay-card.ts';
import type { Traced, TraceEntry } from './trace.ts';

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

/** The card an event belongs to, if any. */
function cardOfEvent(event: StudyEvent): CardId | undefined {
	return event.type === 'acceptAdded' ? undefined : event.cardId;
}

/** Each card's events, in replay order. */
function eventsByCard(events: readonly StudyEvent[]): Map<CardId, StudyEvent[]> {
	const byCard = new Map<CardId, StudyEvent[]>();
	for (const event of sortEvents(events)) {
		const cardId = cardOfEvent(event);
		if (cardId === undefined) continue;
		const list = byCard.get(cardId);
		if (list) list.push(event);
		else byCard.set(cardId, [event]);
	}
	return byCard;
}

/** The first entry for each card ID, ordered by ID so the output never depends on input order. */
function uniqueCards(cards: readonly ReplayCard[]): ReplayCard[] {
	const byId = new Map<CardId, ReplayCard>();
	for (const card of cards) if (!byId.has(card.id)) byId.set(card.id, card);
	return [...byId.values()].sort((a, b) => compareText(a.id, b.id));
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
	const byCard = eventsByCard(events);
	const result = {} as Record<CardId, CardCaches>;
	const trace: TraceEntry[] = [];
	for (const card of uniqueCards(cards)) {
		const input = { path: card.path, fsrs: config.fsrs, tzOffsetMin: config.tzOffsetMin };
		const replayed = replayCard(byCard.get(card.id) ?? [], input);
		result[card.id] = replayed.result;
		const { status, daysCorrect, accuracy } = replayed.result;
		trace.push(...replayed.trace, {
			rule: 'replay.card',
			cardId: card.id,
			status,
			daysCorrect,
			...accuracy
		});
	}
	return { result, trace };
}
