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
export function isWholeCourse(scope: StudyScope | undefined): boolean {
	return scope === undefined || (scope.topicIds.length === 0 && scope.chunkIds.length === 0);
}

/**
 * Whether an item is studied under this scope: the whole course; or its topic is in `topicIds`;
 * or its section is in `chunkIds`. An item with no section is in scope only through its topic.
 *
 * @see SESSION_NOTES J; Decisions log "Phase 8.6 Q12"
 */
export function inScope(item: Placed, scope: StudyScope | undefined): boolean {
	if (scope === undefined || isWholeCourse(scope)) return true;
	if (scope.topicIds.includes(item.topicId)) return true;
	return (
		item.chunkId !== undefined && item.chunkId !== null && scope.chunkIds.includes(item.chunkId)
	);
}

/** The in-scope items, in their given order. @see inScope */
export function scopeItems<T extends Placed>(
	items: readonly T[],
	scope: StudyScope | undefined
): T[] {
	return items.filter((item) => inScope(item, scope));
}

/**
 * "Studying N of M topics": a topic counts when it is listed or one of its sections is listed;
 * the whole course counts every topic and sets `whole`.
 *
 * @see Decisions log "Phase 8.6 Q12"
 */
export function scopeSummary(
	topics: readonly { id: TopicId; chunkIds: readonly ChunkId[] }[],
	scope: StudyScope | undefined
): { topics: number; of: number; whole: boolean } {
	const of = topics.length;
	if (scope === undefined || isWholeCourse(scope)) return { topics: of, of, whole: true };
	const listed = topics.filter(
		(topic) =>
			scope.topicIds.includes(topic.id) || topic.chunkIds.some((id) => scope.chunkIds.includes(id))
	);
	return { topics: listed.length, of, whole: false };
}
