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
 * Compares two events by `(ts, deviceId, seq)`: how `sortEvents` picks between the next events of
 * different devices.
 *
 * @see BUILD_PLAN §6.12 (event order)
 */
export function compareEvents(a: EventOrderKey, b: EventOrderKey): number {
	return a.ts - b.ts || compareText(a.deviceId, b.deviceId) || a.seq - b.seq;
}

type Keyed = EventOrderKey & { id: string };

/** One device's events in `seq` order; `ts`, then `id`, settle seq ties. */
function deviceStream<T extends Keyed>(events: readonly T[]): T[] {
	return [...events].sort((a, b) => a.seq - b.seq || a.ts - b.ts || compareText(a.id, b.id));
}

/** Index of the stream whose next event comes first by `(ts, deviceId, seq, id)`, or -1. */
function firstHead<T extends Keyed>(streams: readonly T[][], at: readonly number[]): number {
	let best = -1;
	streams.forEach((stream, i) => {
		const head = stream[at[i] ?? 0];
		const current = best < 0 ? undefined : streams[best]?.[at[best] ?? 0];
		if (head === undefined) return;
		if (!current || (compareEvents(head, current) || compareText(head.id, current.id)) < 0)
			best = i;
	});
	return best;
}

/**
 * The one replay order on every device: each device's events in `seq` order (its clock may jump
 * back, its counter can't), devices interleaved by repeatedly taking the next event with the
 * smallest `(ts, deviceId, seq, id)`. Never depends on the input order.
 *
 * @see BUILD_PLAN §6.12 (event order) and Decisions log (Fix pass: replay order)
 */
export function sortEvents<T extends Keyed>(events: readonly T[]): T[] {
	const byDevice = new Map<string, T[]>();
	for (const event of events) {
		const stream = byDevice.get(event.deviceId);
		if (stream) stream.push(event);
		else byDevice.set(event.deviceId, [event]);
	}
	const streams = [...byDevice.values()].map(deviceStream);
	const at = streams.map(() => 0);
	const out: T[] = [];
	for (let i = firstHead(streams, at); i >= 0; i = firstHead(streams, at)) {
		out.push(streams[i]?.[at[i] ?? 0] as T);
		at[i] = (at[i] ?? 0) + 1;
	}
	return out;
}

/** The card an event belongs to, if any. */
function cardOfEvent(event: StudyEvent): CardId | undefined {
	return event.type === 'acceptAdded' ? undefined : event.cardId;
}

/**
 * Reviews re-judged by "I was right": an `acceptAdded` naming a review makes it count as correct,
 * whatever order the two arrive in.
 *
 * @see BUILD_PLAN §6.10 (accept list) and Decisions log (Phase 5: "I was right")
 */
function rejudged(events: readonly StudyEvent[]): StudyEvent[] {
	const ids = new Set<string>();
	for (const event of events) {
		if (event.type === 'acceptAdded' && event.reviewEventId) ids.add(event.reviewEventId);
	}
	if (ids.size === 0) return [...events];
	return events.map((event) =>
		event.type === 'review' && ids.has(event.id) ? { ...event, correct: true } : event
	);
}

/** Each card's events, in replay order. */
function eventsByCard(events: readonly StudyEvent[]): Map<CardId, StudyEvent[]> {
	const byCard = new Map<CardId, StudyEvent[]>();
	for (const event of sortEvents(rejudged(events))) {
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
