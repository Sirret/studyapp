import type { ChunkId, TopicId } from '#lib/db/schemas/common.ts';
import type { StudyScope } from '#lib/db/schemas/kv.ts';

/** Anything that sits in a topic and maybe a section (a note, or a card with its note's place). */
export interface Placed {
	topicId: TopicId;
	chunkId?: ChunkId | null;
}

/**
 * A scope that selects the whole course: none stored, or both lists empty.
 *
 * @see SESSION_NOTES J ("Study all" is the default)
 */
export function isWholeCourse(_scope: StudyScope | undefined): boolean {
	throw new Error('not implemented');
}

/**
 * Whether an item is studied under this scope: the whole course; or its topic is in `topicIds`;
 * or its section is in `chunkIds`. An item with no section is in scope only through its topic.
 *
 * @see SESSION_NOTES J; Decisions log "Phase 8.6 Q12"
 */
export function inScope(_item: Placed, _scope: StudyScope | undefined): boolean {
	throw new Error('not implemented');
}

/** The in-scope items, in their given order. @see inScope */
export function scopeItems<T extends Placed>(
	_items: readonly T[],
	_scope: StudyScope | undefined
): T[] {
	throw new Error('not implemented');
}

/**
 * "Studying N of M topics": a topic counts when it is listed or one of its sections is listed;
 * the whole course counts every topic and sets `whole`.
 *
 * @see Decisions log "Phase 8.6 Q12"
 */
export function scopeSummary(
	_topics: readonly { id: TopicId; chunkIds: readonly ChunkId[] }[],
	_scope: StudyScope | undefined
): { topics: number; of: number; whole: boolean } {
	throw new Error('not implemented');
}
