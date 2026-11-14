import type { NoteType } from '#lib/db/schemas/note.ts';
import type { ImportPlan } from '#lib/import/build.ts';
import { readLine, splitLines } from '#lib/import/lexer.ts';
import type { StarredGap } from '#lib/import/validate.ts';
import { fileKey } from '#lib/import/zip.ts';

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

/** The file keys a plan needs images for. */
export function referencedFiles(plan: ImportPlan): Set<string> {
	const files = plan.topics
		.flatMap((topic) => topic.notes)
		.flatMap((note) => [
			...(note.content.type === 'occlusion' ? [note.content.file] : []),
			...(note.sourceFile ? [note.sourceFile] : [])
		]);
	return new Set(files.map(fileKey));
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
