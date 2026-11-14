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

/** The plan with duplicates removed, and what was removed. */
export interface DuplicateSplit {
	topics: PlannedTopic[];
	skipped: SkippedDuplicate[];
}

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

/**
 * A key that two notes share exactly when they ask the same thing: the note type and its payload
 * with text normalised (case, spacing, punctuation at the ends). `null` for image notes
 * (occlusion, diagram), which are never treated as duplicates.
 *
 * @see BUILD_PLAN §10 row 8.5 ("skip duplicate notes on re-import")
 */
export function noteFingerprint(content: NoteContent | PlannedContent): string | null {
	if (content.type === 'occlusion' || content.type === 'diagram') return null;
	return JSON.stringify([content.type, canonical(content.payload)]);
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
 * same paste, so re-importing the same text adds nothing. Topics, sections and the order of the
 * notes that stay are unchanged.
 *
 * @see BUILD_PLAN §10 row 8.5
 */
export function dropDuplicateNotes(
	topics: readonly PlannedTopic[],
	existing: readonly NoteContent[]
): Traced<DuplicateSplit> {
	const seen = new Set<string>();
	for (const content of existing) {
		const print = noteFingerprint(content);
		if (print !== null) seen.add(print);
	}
	const skipped: SkippedDuplicate[] = [];
	const kept = topics.map((topic) => ({
		...topic,
		notes: topic.notes.filter((note) => {
			const print = noteFingerprint(note.content);
			if (print === null) return true;
			if (seen.has(print)) {
				skipped.push({ line: note.line, topic: topic.name });
				return false;
			}
			seen.add(print);
			return true;
		})
	}));
	return {
		result: { topics: kept, skipped },
		trace: [{ rule: 'skip-duplicate-notes', existing: existing.length, skipped: skipped.length }]
	};
}
