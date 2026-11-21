import type { NoteContent } from '#lib/engine/cardgen.ts';
import type { Traced } from '#lib/engine/trace.ts';
import type { PlannedChunk, PlannedContent, PlannedTopic } from './build.ts';

/** A planned note left out because the course already has the same note. */
export interface SkippedDuplicate {
	/** Its line in the pasted text. */
	line: number;
	/** The topic it was planned under. */
	topic: string;
}

/** A planned diagram named like one the course has, with different arrows or layers: kept. */
export interface ChangedDiagram extends SkippedDuplicate {
	name: string;
}

/** The plan with duplicates removed, and what was removed. */
export interface DuplicateSplit {
	topics: PlannedTopic[];
	skipped: SkippedDuplicate[];
	/** Diagrams kept next to an older one of the same name ("changed diagram: kept both"). */
	changed: ChangedDiagram[];
}

/**
 * Which stored image an occlusion note shows, so the same picture imported again is found: a
 * planned note's file and a stored note's media ID both resolve to one key (the stored media ID,
 * or a key for an image not stored yet). `undefined` when it can't be told; such a note is kept.
 */
export interface ImageIdentity {
	ofFile(file: string): string | undefined;
	ofMedia(mediaId: string): string | undefined;
}

const NO_IMAGES: ImageIdentity = { ofFile: () => undefined, ofMedia: () => undefined };

/**
 * Any run of characters that are not letters or digits at either end of a text, which a
 * fingerprint ignores (Decisions log, Phase 8.5 step 2 SPEC-GAPs).
 */
const END_NOISE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

function normaliseText(text: string): string {
	return text.toLowerCase().replace(/\s+/g, ' ').replace(END_NOISE, '');
}

/** The value with every string normalised and object keys sorted, so key order never matters. */
function canonical(value: unknown): unknown {
	if (typeof value === 'string') return normaliseText(value);
	if (Array.isArray(value)) return value.map(canonical);
	if (value !== null && typeof value === 'object') {
		const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return Object.fromEntries(entries.map(([key, inner]) => [key, canonical(inner)]));
	}
	return value;
}

type DiagramContent = Extract<NoteContent, { type: 'diagram' }>;

function sortedJson(items: unknown[]): string[] {
	return items.map((item) => JSON.stringify(canonical(item))).sort();
}

/**
 * A diagram's structure by labels, never IDs: a stack's layers in order, a flow's nodes and
 * arrows (from, to, label) in any order. The name and the source image are not part of it.
 */
function diagramStructure({ payload }: DiagramContent): unknown {
	const labelOf = new Map(payload.nodes.map((node) => [node.id, node.label]));
	if (payload.kind === 'stack') {
		return ['stack', canonical(payload.nodes.map(({ label, role }) => [label, role ?? '']))];
	}
	const edges = payload.edges.map((edge) => [
		labelOf.get(edge.from) ?? '',
		labelOf.get(edge.to) ?? '',
		edge.label ?? ''
	]);
	return ['flow', sortedJson(payload.nodes.map((node) => node.label)), sortedJson(edges)];
}

/**
 * A key that two notes share exactly when they ask the same thing: the note type and its payload
 * with text normalised (case, spacing, punctuation at the ends). A diagram's key is its structure
 * by labels (IDs, name and source image ignored); an occlusion note's is its image, through
 * `images`. `null` when an image can't be identified: such a note is never a duplicate.
 *
 * @see BUILD_PLAN §10 row 8.5 ("skip duplicate notes on re-import"); Decisions log "Phase 6 Q10–Q13"
 */
export function noteFingerprint(
	content: NoteContent | PlannedContent,
	images: ImageIdentity = NO_IMAGES
): string | null {
	if (content.type === 'occlusion') {
		const key =
			'file' in content ? images.ofFile(content.file) : images.ofMedia(content.payload.mediaId);
		return key === undefined ? null : JSON.stringify(['occlusion', key]);
	}
	if (content.type === 'diagram') return JSON.stringify(['diagram', diagramStructure(content)]);
	return JSON.stringify([content.type, canonical(content.payload)]);
}

/** A diagram's kind and name, normalised, to tell a changed diagram from a new one. */
function diagramName(content: NoteContent | PlannedContent): string | null {
	if (content.type !== 'diagram') return null;
	return JSON.stringify([content.payload.kind, normaliseText(content.payload.name)]);
}

/**
 * A key that two sections share exactly when they have the same title and reading (text
 * normalised as in `noteFingerprint`). The import drafter reuses an existing section of the
 * matched topic with the same key instead of adding a copy, and points the planned notes of that
 * section at it, so re-importing the same text adds no sections either.
 *
 * @see BUILD_PLAN §10 row 8.5
 */
export function sectionFingerprint(chunk: Pick<PlannedChunk, 'title' | 'text'>): string {
	return JSON.stringify([normaliseText(chunk.title ?? ''), normaliseText(chunk.text)]);
}

/**
 * Removes planned notes that the course already has (any topic), or that appear earlier in the
 * same paste, so re-importing the same text adds nothing: the same text notes, an identical
 * diagram, or an occlusion note on an image the course already has one for (its boxes stay as
 * they are). A diagram named like an existing one but with other arrows or layers is kept and
 * listed in `changed`. Topics, sections and the order of the notes that stay are unchanged.
 *
 * @see BUILD_PLAN §10 row 8.5; Decisions log "Phase 6 Q10–Q13"
 */
export function dropDuplicateNotes(
	topics: readonly PlannedTopic[],
	existing: readonly NoteContent[],
	images: ImageIdentity = NO_IMAGES
): Traced<DuplicateSplit> {
	const seen = new Set<string>();
	const diagramNames = new Set<string>();
	const remember = (content: NoteContent | PlannedContent, print: string | null): void => {
		if (print !== null) seen.add(print);
		const name = diagramName(content);
		if (name !== null) diagramNames.add(name);
	};
	for (const content of existing) remember(content, noteFingerprint(content, images));
	const skipped: SkippedDuplicate[] = [];
	const changed: ChangedDiagram[] = [];
	const kept = topics.map((topic) => ({
		...topic,
		notes: topic.notes.filter((note) => {
			const print = noteFingerprint(note.content, images);
			if (print !== null && seen.has(print)) {
				skipped.push({ line: note.line, topic: topic.name });
				return false;
			}
			const name = diagramName(note.content);
			if (name !== null && diagramNames.has(name) && note.content.type === 'diagram') {
				changed.push({ line: note.line, topic: topic.name, name: note.content.payload.name });
			}
			remember(note.content, print);
			return true;
		})
	}));
	return {
		result: { topics: kept, skipped, changed },
		trace: [
			{
				rule: 'skip-duplicate-notes',
				existing: existing.length,
				skipped: skipped.length,
				changed: changed.length
			}
		]
	};
}
