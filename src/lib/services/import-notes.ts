import type { RepoManaged } from '#lib/db/repos/content-repo.ts';
import type { ChunkId, CourseId, MediaId, TopicId } from '#lib/db/schemas/common.ts';
import type { DistributiveOmit } from '#lib/db/schemas/event.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import type { PlannedContent, PlannedNote } from '#lib/import/build.ts';
import type { NoteContent } from '#lib/engine/cardgen.ts';
import { fileKey } from '#lib/import/zip.ts';

/** Where a planned note goes. */
export interface NotePlace {
	courseId: CourseId;
	topicId: TopicId;
	chunkId?: ChunkId;
	order: number;
}

function requireMedia(mediaIds: ReadonlyMap<string, MediaId>, file: string): MediaId {
	const mediaId = mediaIds.get(fileKey(file));
	if (!mediaId) throw new Error(`No stored image for ${file}`);
	return mediaId;
}

/** Swaps file names in a planned note for the IDs of the stored images. */
function resolveContent(
	content: PlannedContent,
	sourceFile: string | undefined,
	mediaIds: ReadonlyMap<string, MediaId>
): NoteContent {
	if (content.type === 'occlusion') {
		return {
			type: 'occlusion',
			payload: { mediaId: requireMedia(mediaIds, content.file), boxes: [] }
		};
	}
	if (content.type === 'diagram' && sourceFile) {
		return {
			type: 'diagram',
			payload: { ...content.payload, sourceMediaId: requireMedia(mediaIds, sourceFile) }
		};
	}
	return content;
}

/**
 * The fields to write for a planned note, once its images are stored.
 *
 * @see DATA_MODEL §3.4
 */
export function toNoteFields(
	planned: PlannedNote,
	place: NotePlace,
	mediaIds: ReadonlyMap<string, MediaId>
): DistributiveOmit<Note, RepoManaged> {
	const { chunkId, ...rest } = place;
	return {
		...rest,
		...(chunkId ? { chunkId } : {}),
		priority: planned.priority,
		tags: planned.tags,
		generated: planned.isGenerated,
		check: planned.isChecked,
		accept: {},
		...resolveContent(planned.content, planned.sourceFile, mediaIds)
	};
}
