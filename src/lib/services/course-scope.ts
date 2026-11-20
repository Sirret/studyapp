import type { KvRepo } from '#lib/db/repos/kv-repo.ts';
import type { CourseId } from '#lib/db/schemas/common.ts';
import type { StudyScope } from '#lib/db/schemas/kv.ts';
import { inScope, isWholeCourse } from '#lib/engine/scope.ts';
import type { CourseData } from './course-plan.ts';

/** The course's stored study scope, or `undefined` for the whole course. @see Decisions log "Phase 8.6 Q12" */
export async function courseScope(
	kv: Pick<KvRepo, 'get'>,
	courseId: CourseId
): Promise<StudyScope | undefined> {
	return (await kv.get('studyScope'))?.[courseId];
}

/**
 * The course data as Exam prep sees it under a scope: only in-scope notes and their cards, in-scope
 * sections, and topics that are listed or have a listed section. Events are kept whole (they are
 * looked up by card). The whole course returns `data` unchanged.
 *
 * @see SESSION_NOTES J; Decisions log "Phase 8.6 Q12"
 */
export function scopeCourseData(data: CourseData, scope: StudyScope | undefined): CourseData {
	if (scope === undefined || isWholeCourse(scope)) return data;
	const notes = new Map(
		[...data.material.notes].filter(([, note]) =>
			inScope({ topicId: note.topicId, chunkId: note.chunkId ?? null }, scope)
		)
	);
	const chunks = data.chunks.filter((chunk) =>
		inScope({ topicId: chunk.topicId, chunkId: chunk.id }, scope)
	);
	const topicIds = new Set([...scope.topicIds, ...chunks.map((chunk) => chunk.topicId)]);
	return {
		...data,
		material: {
			...data.material,
			cards: data.material.cards.filter((card) => notes.has(card.noteId)),
			notes
		},
		topics: data.topics.filter((topic) => topicIds.has(topic.id)),
		chunks
	};
}
