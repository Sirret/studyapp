import type { Card } from '#lib/db/schemas/card.ts';
import type { CardId, DeviceId } from '#lib/db/schemas/common.ts';
import type { Chunk, Course, Media, Topic } from '#lib/db/schemas/course.ts';
import type { StudyEvent } from '#lib/db/schemas/event.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import { compareText, sortEvents } from './replay.ts';
import type { TraceEntry, Traced } from './trace.ts';

/** One device's data: every record that merges. */
export interface MergeData {
	courses: Course[];
	topics: Topic[];
	chunks: Chunk[];
	notes: Note[];
	cards: Card[];
	media: Media[];
	events: StudyEvent[];
}

/** The merged data, and the cards that must be replayed because their history changed. */
export interface MergeResult {
	data: MergeData;
	affectedCardIds: CardId[];
}

/** The fields last-write-wins compares. */
export type LwwRecord = { updatedAt: number; deviceId: DeviceId; deleted?: true };

/** A form of a record that doesn't depend on key order, so records have a total order. */
function canonicalJson(value: unknown): string {
	return JSON.stringify(value, (_key, field: unknown) => {
		if (field === null || typeof field !== 'object' || Array.isArray(field)) return field;
		const entries = Object.entries(field).sort(([a], [b]) => compareText(a, b));
		return Object.fromEntries(entries);
	});
}

function compareLww(a: LwwRecord, b: LwwRecord): number {
	return (
		a.updatedAt - b.updatedAt ||
		compareText(a.deviceId, b.deviceId) ||
		Number(a.deleted === true) - Number(b.deleted === true) ||
		compareText(canonicalJson(a), canonicalJson(b))
	);
}

/**
 * Returns the record that wins: newest `(updatedAt, deviceId)`. If those tie, a tombstone wins, then
 * the higher canonical form, so the choice never depends on argument order.
 *
 * @see BUILD_PLAN §6.12
 * @see DATA_MODEL legend (content)
 */
export function pickWinner<T extends LwwRecord>(a: T, b: T): T {
	return compareLww(a, b) >= 0 ? a : b;
}

/** Collapses records to one per `id`. */
function indexById<T extends { id: string }>(
	records: readonly T[],
	choose: (a: T, b: T) => T
): Map<string, T> {
	const index = new Map<string, T>();
	for (const record of records) {
		const existing = index.get(record.id);
		index.set(record.id, existing ? choose(existing, record) : record);
	}
	return index;
}

function mergeTable<T extends LwwRecord & { id: string }>(
	table: string,
	a: readonly T[],
	b: readonly T[],
	trace: TraceEntry[]
): T[] {
	const left = indexById(a, pickWinner);
	const right = indexById(b, pickWinner);
	const ids = [...new Set([...left.keys(), ...right.keys()])].sort(compareText);
	return ids.flatMap((id) => {
		const [first, second] = [left.get(id), right.get(id)];
		if (!first || !second) return first ?? second ?? [];
		const winner = pickWinner(first, second);
		if (canonicalJson(first) !== canonicalJson(second)) {
			const { updatedAt, deviceId, deleted } = winner;
			trace.push({ rule: 'merge.content', table, id, updatedAt, deviceId, deleted: !!deleted });
		}
		return winner;
	});
}

/** Events are append-only, so a shared `id` should mean equal bodies; if not, choose stably. */
function pickEvent(a: StudyEvent, b: StudyEvent): StudyEvent {
	return compareText(canonicalJson(a), canonicalJson(b)) >= 0 ? a : b;
}

function eventCardId(event: StudyEvent | undefined): CardId | undefined {
	return event && 'cardId' in event ? event.cardId : undefined;
}

/** The cards left with stale caches: a side lacks this event, or holds a different body. */
function staleCardIds(first: StudyEvent | undefined, second: StudyEvent | undefined): CardId[] {
	if (first && second && canonicalJson(first) === canonicalJson(second)) return [];
	return [eventCardId(first), eventCardId(second)].filter((id) => id !== undefined);
}

function mergeEvents(a: readonly StudyEvent[], b: readonly StudyEvent[], trace: TraceEntry[]) {
	const left = indexById(a, pickEvent);
	const right = indexById(b, pickEvent);
	const affected = new Set<CardId>();
	const merged: StudyEvent[] = [];
	for (const id of new Set([...left.keys(), ...right.keys()])) {
		const [first, second] = [left.get(id), right.get(id)];
		const winner = first && second ? pickEvent(first, second) : (first ?? second);
		if (winner) merged.push(winner);
		for (const cardId of staleCardIds(first, second)) affected.add(cardId);
	}
	const affectedCardIds = [...affected].sort(compareText);
	trace.push({ rule: 'merge.events', total: merged.length, affectedCards: affectedCardIds.length });
	return { events: sortEvents(merged), affectedCardIds };
}

/**
 * Merges two devices' data. Events are the union by `id`, sorted in replay order; content records
 * are last-write-wins, sorted by `id`. Commutative and idempotent. A merged card's cache fields are
 * stale until the caller replays the cards in `affectedCardIds`: those with an event held by only
 * one side, sorted.
 *
 * @see BUILD_PLAN §6.12
 */
export function merge(a: MergeData, b: MergeData): Traced<MergeResult> {
	const trace: TraceEntry[] = [];
	const { events, affectedCardIds } = mergeEvents(a.events, b.events, trace);
	const data: MergeData = {
		courses: mergeTable('courses', a.courses, b.courses, trace),
		topics: mergeTable('topics', a.topics, b.topics, trace),
		chunks: mergeTable('chunks', a.chunks, b.chunks, trace),
		notes: mergeTable('notes', a.notes, b.notes, trace),
		cards: mergeTable('cards', a.cards, b.cards, trace),
		media: mergeTable('media', a.media, b.media, trace),
		events
	};
	return { result: { data, affectedCardIds }, trace };
}
