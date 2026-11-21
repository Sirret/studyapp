import type { ContentStore } from '#lib/db/repos/content-store.ts';
import type { ChunkId, CourseId, MediaId, NoteId, TopicId } from '#lib/db/schemas/common.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import { mergeDiagram, renameNode, type DiagramStructure } from '#lib/engine/diagram-edit.ts';
import type { DiagramLayout } from '#lib/engine/diagram-layout.ts';
import { generateCards } from '#lib/engine/cardgen.ts';
import {
	formatDiagram,
	parseDiagramText,
	type DiagramTextError
} from '#lib/import/diagram-parser.ts';
import type { Logger } from '#lib/log/logger.ts';
import type { Result } from '#lib/util/result.ts';
import { previewDiagram, type DiagramPreview } from './figure-edit.ts';
import { draftNewNote, type NoteRegenWriter } from './note-regen.ts';
import { saveErrorMessage } from './storage-guard.ts';

const LOG_AREA = 'diagram';

type DiagramNote = Extract<Note, { type: 'diagram' }>;
type DiagramKind = DiagramStructure['kind'];

export type { DiagramLayout, DiagramPreview, DiagramTextError };

/** Why a diagram save failed: a message, and the text lines that couldn't be read (if any). */
export interface DiagramSaveError {
	message: string;
	lines: DiagramTextError[];
}

/** A diagram note as the editor opens it. */
export interface DiagramDoc {
	noteId: NoteId;
	courseId: CourseId;
	topicId: TopicId;
	kind: DiagramKind;
	name: string;
	/** The diagram in the import grammar, for the text editor. */
	text: string;
	/** The current nodes, for the rename list (renaming keeps the ID). */
	nodes: { id: string; label: string }[];
	sourceMediaId?: MediaId;
}

const unreadable = (lines: DiagramTextError[]): Result<never, DiagramSaveError> => ({
	ok: false,
	error: { message: 'Some lines could not be read.', lines }
});

/**
 * The diagram editor's service (text first): open a diagram note as text, preview an edit,
 * save it keeping node IDs by label and arrow IDs by (from, to) so unchanged parts keep their
 * cards, rename a node keeping its ID, and make a new diagram note.
 *
 * @see BUILD_PLAN §7.2; Decisions log "Phase 6 Q4", "Phase 6 Q5"
 */
export class DiagramService {
	constructor(
		private readonly store: ContentStore,
		private readonly writer: NoteRegenWriter,
		private readonly newId: () => string,
		private readonly logger: Logger
	) {}

	/** The note as text, or `null` when it is gone or not a diagram. */
	async load(noteId: NoteId): Promise<DiagramDoc | null> {
		const note = await this.store.notes.get(noteId);
		if (note?.type !== 'diagram') return null;
		const { kind, name, nodes, sourceMediaId } = note.payload;
		return {
			noteId: note.id,
			courseId: note.courseId,
			topicId: note.topicId,
			kind,
			name,
			text: formatDiagram(note.payload),
			nodes: nodes.map(({ id, label }) => ({ id, label })),
			...(sourceMediaId ? { sourceMediaId } : {})
		};
	}

	/** What `text` would draw, writing nothing; preview IDs are throwaway. */
	preview(kind: DiagramKind, text: string): DiagramPreview {
		return previewDiagram(kind, text);
	}

	/** Saves edited text; any unreadable line saves nothing. */
	async saveText(
		noteId: NoteId,
		text: string
	): Promise<Result<{ cards: number }, DiagramSaveError>> {
		const note = await this.store.notes.get(noteId);
		if (note?.type !== 'diagram') return failed('This diagram no longer exists.');
		const { parsed, errors } = parseDiagramText(note.payload.kind, text);
		if (!parsed) return unreadable(errors);
		const { result, trace } = mergeDiagram(note.payload, parsed, note.payload.name, this.newId);
		this.logger.info(LOG_AREA, 'diagram text merged', { noteId, trace });
		return this.write(note, result);
	}

	/** Renames one node, keeping its ID and so its cards. */
	async rename(
		noteId: NoteId,
		nodeId: string,
		label: string
	): Promise<Result<{ cards: number }, DiagramSaveError>> {
		const note = await this.store.notes.get(noteId);
		if (note?.type !== 'diagram') return failed('This diagram no longer exists.');
		const renamed = renameNode(note.payload, nodeId, label);
		if (!renamed.ok) return failed(renamed.error);
		return this.write(note, renamed.value);
	}

	/** A new diagram note at the end of the topic, from its name, kind and text. */
	async create(
		topicId: TopicId,
		chunkId: ChunkId | null,
		input: { kind: DiagramKind; name: string; text: string }
	): Promise<Result<NoteId, DiagramSaveError>> {
		const topic = await this.store.topics.get(topicId);
		if (!topic) return failed('This topic no longer exists.');
		const name = input.name.trim();
		if (name === '') return failed('A diagram needs a name.');
		const { parsed, errors } = parseDiagramText(input.kind, input.text);
		if (!parsed) return unreadable(errors);
		const payload = mergeDiagram(null, parsed, name, this.newId).result;
		const deviceId = await this.store.getDeviceId();
		const content = { type: 'diagram' as const, payload: payload as DiagramNote['payload'] };
		const note = await draftNewNote(this.store, topic, chunkId, content, deviceId);
		const { result: specs } = generateCards(content);
		const cards = specs.map((spec) =>
			this.store.cards.draft(
				{ noteId: note.id, courseId: topic.courseId, ...spec, suspended: false },
				deviceId
			)
		);
		try {
			await this.store.putBatch({ notes: [note], cards });
		} catch (error) {
			return failed(saveErrorMessage(error, 'Could not save this diagram.'));
		}
		this.logger.info(LOG_AREA, 'diagram note added', { noteId: note.id, cards: cards.length });
		return { ok: true, value: note.id };
	}

	private async write(
		note: DiagramNote,
		diagram: DiagramStructure
	): Promise<Result<{ cards: number }, DiagramSaveError>> {
		const content = { type: 'diagram' as const, payload: diagram as DiagramNote['payload'] };
		const saved = await this.writer.save(note, content, { area: LOG_AREA });
		return saved.ok ? saved : failed(saved.error);
	}
}

function failed(message: string): Result<never, DiagramSaveError> {
	return { ok: false, error: { message, lines: [] } };
}
