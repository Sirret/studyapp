import type { Chunk } from '#lib/db/schemas/course.ts';
import type { Priority } from '#lib/db/schemas/common.ts';
import type { CardSpec, NoteContent } from '#lib/engine/cardgen.ts';
import type { ImportDocument, ImportError } from './ast.ts';

/** A note's content before its image exists in `media`: occlusion names the file instead. */
export type PlannedContent =
	Exclude<NoteContent, { type: 'occlusion' }> | { type: 'occlusion'; file: string };

/** A chunk about to be written. @see DATA_MODEL §3.3 */
export interface PlannedChunk extends Pick<Chunk, 'text' | 'words' | 'source' | 'check'> {
	line: number;
}

/** A note and its cards about to be written. @see DATA_MODEL §3.4 */
export interface PlannedNote {
	line: number;
	content: PlannedContent;
	/** The image a diagram was drawn from, if its block named one. */
	sourceFile?: string;
	/** Index into the topic's `chunks`. */
	chunkIndex?: number;
	priority: Priority;
	tags: string[];
	isGenerated: boolean;
	isChecked: boolean;
	cards: CardSpec[];
}

/** A topic and everything under it, in file order. @see DATA_MODEL §3.2 */
export interface PlannedTopic {
	name: string;
	priority: Priority;
	chunks: PlannedChunk[];
	notes: PlannedNote[];
}

/** Everything the valid part of an import would create. */
export interface ImportPlan {
	topics: PlannedTopic[];
	/** Sections listed by `@coverage`; shown in the preview, never stored. */
	coverage: string[];
}

/** What the builder needs from outside. */
export interface BuildContext {
	/** Attached images, as `fileKey()` values. */
	files: ReadonlySet<string>;
	newId: () => string;
}

/**
 * Turns parsed blocks into topics, chunks, notes and cards, without touching storage.
 *
 * @see BUILD_PLAN §4 and §5
 */
export function buildPlan(
	_document: ImportDocument,
	_context: BuildContext
): { plan: ImportPlan; errors: ImportError[] } {
	throw new Error('not implemented');
}
