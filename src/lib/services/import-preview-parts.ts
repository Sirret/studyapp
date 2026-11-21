import type { MediaRepo } from '#lib/db/repos/content-repos.ts';
import type { NoteId } from '#lib/db/schemas/common.ts';
import type { Media, Topic } from '#lib/db/schemas/course.ts';
import type { Note, NoteType } from '#lib/db/schemas/note.ts';
import type { ImageIdentity } from '#lib/import/duplicates.ts';
import type { ImportPlan, PlannedTopic } from '#lib/import/build.ts';
import { readLine, splitLines } from '#lib/import/lexer.ts';
import type { StarredGap } from '#lib/import/validate.ts';
import { imageKey } from '#lib/import/zip.ts';
import type { PreparedImage, TopicPreview } from './import-service.ts';

/** A line the chatbot marked `[CHECK]`. */
export interface CheckedItem {
	line: number;
	text: string;
}

/** The SHA-256 of a blob's bytes, as hex. @see BUILD_PLAN §4.2 */
export async function sha256Hex(blob: Blob): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The image keys a plan needs images for. */
export function referencedFiles(plan: ImportPlan): Set<string> {
	const files = plan.topics
		.flatMap((topic) => topic.notes)
		.flatMap((note) => [
			...(note.content.type === 'occlusion' ? [note.content.file] : []),
			...(note.sourceFile ? [note.sourceFile] : [])
		]);
	return new Set(files.map(imageKey));
}

/** How many notes of each type the plan has. */
export function countNoteTypes(plan: ImportPlan): Partial<Record<NoteType, number>> {
	const counts: Partial<Record<NoteType, number>> = {};
	for (const note of plan.topics.flatMap((topic) => topic.notes)) {
		counts[note.content.type] = (counts[note.content.type] ?? 0) + 1;
	}
	return counts;
}

/** The notes and sections marked `[CHECK]`, with their first line of text, in line order. */
export function checkedItems(plan: ImportPlan, text: string): CheckedItem[] {
	const sourceLines = splitLines(text);
	const fromNotes = plan.topics
		.flatMap((topic) => topic.notes)
		.filter((note) => note.isChecked)
		.map(({ line }) => ({ line, text: readLine(sourceLines[line - 1] ?? '').text }));
	const fromChunks = plan.topics
		.flatMap((topic) => topic.chunks)
		.filter((chunk) => chunk.check)
		.map(({ line, text: chunkText }) => ({ line, text: chunkText.split('\n')[0] ?? '' }));
	return [...fromNotes, ...fromChunks].sort((a, b) => a.line - b.line);
}

/** Flags the notes of cards whose starred words their reading doesn't say (preview shows them). */
export function flagGaps(plan: ImportPlan, gaps: readonly StarredGap[]): void {
	const lines = new Set(gaps.map((gap) => gap.line));
	for (const note of plan.topics.flatMap((topic) => topic.notes)) {
		if (lines.has(note.line)) note.isChecked = true;
	}
}

/**
 * Tells which stored image each attached file is (by original-file hash, then stored hash for
 * images saved before Phase 6, as the drafter does), so an occlusion note on a picture the course
 * already has is found. A file not stored yet is keyed by its original-file hash.
 *
 * @see DATA_MODEL §3.8; Decisions log "Phase 6 Q10–Q13"
 */
export async function imageIdentity(
	media: Pick<MediaRepo, 'findBySourceHash' | 'findByHash'>,
	images: readonly PreparedImage[]
): Promise<ImageIdentity> {
	const byKey = new Map<string, string>();
	for (const image of images) {
		const stored =
			(await media.findBySourceHash(image.sourceHash)) ?? (await media.findByHash(image.hash));
		byKey.set(imageKey(image.fileName), stored ? stored.id : `new:${image.sourceHash}`);
	}
	return { ofFile: (file) => byKey.get(imageKey(file)), ofMedia: (mediaId) => mediaId };
}

/** What one planned topic adds, for the preview; `existing` is the course topic it joins. */
export function topicPreview(topic: PlannedTopic, existing: Topic | undefined): TopicPreview {
	return {
		name: topic.name,
		existing,
		chunks: topic.chunks.length,
		notes: topic.notes.length,
		cards: topic.notes.reduce((sum, note) => sum + note.cards.length, 0)
	};
}

/** An imported image note whose `box:` labels still need a place ("Place 5 labels"). */
export interface LabelsToPlace {
	noteId: NoteId;
	/** The image's title, else its file name. */
	name: string;
	count: number;
}

/**
 * The image notes of a commit with labels still to place, for the import's done screen.
 *
 * @see WIP step 9; Decisions log "Phase 6 step 6"
 */
export function labelsToPlace(notes: readonly Note[], media: readonly Media[]): LabelsToPlace[] {
	const names = new Map(media.map((image) => [image.id, image.fileName]));
	return notes.flatMap((note) => {
		if (note.type !== 'occlusion') return [];
		const count = note.payload.unplaced?.length ?? 0;
		if (count === 0) return [];
		const name = note.payload.title ?? names.get(note.payload.mediaId) ?? 'An image';
		return [{ noteId: note.id, name, count }];
	});
}
