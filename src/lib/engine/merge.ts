import type { Card } from '#lib/db/schemas/card.ts';
import type { CardId, DeviceId } from '#lib/db/schemas/common.ts';
import type { Chunk, Course, Media, Topic } from '#lib/db/schemas/course.ts';
import type { StudyEvent } from '#lib/db/schemas/event.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import type { Traced } from './trace.ts';

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

/**
 * Returns the record that wins: newest `(updatedAt, deviceId)`. If those tie, a tombstone wins, so
 * the choice never depends on argument order.
 *
 * @see BUILD_PLAN §6.12
 * @see DATA_MODEL legend (content)
 */
export function pickWinner<T extends LwwRecord>(_a: T, _b: T): T {
	throw new Error('not implemented');
}

/**
 * Merges two devices' data. Events are the union by `id`, sorted in replay order; content records
 * are last-write-wins, sorted by `id`. Commutative and idempotent. A merged card's cache fields are
 * stale until the caller replays the cards in `affectedCardIds`: those with an event held by only
 * one side, sorted.
 *
 * @see BUILD_PLAN §6.12
 */
export function merge(_a: MergeData, _b: MergeData): Traced<MergeResult> {
	throw new Error('not implemented');
}
