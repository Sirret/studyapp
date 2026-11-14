import type { NoteContent } from '#lib/engine/cardgen.ts';
import type { Traced } from '#lib/engine/trace.ts';
import type { PlannedContent, PlannedTopic } from './build.ts';

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
 * A key that two notes share exactly when they ask the same thing: the note type and its payload
 * with text normalised (case, spacing, punctuation at the ends). `null` for image notes
 * (occlusion, diagram), which are never treated as duplicates.
 *
 * @see BUILD_PLAN §10 row 8.5 ("skip duplicate notes on re-import")
 */
export function noteFingerprint(_content: NoteContent | PlannedContent): string | null {
	throw new Error('not implemented');
}

/**
 * Removes planned notes that the course already has (any topic), or that appear earlier in the
 * same paste, so re-importing the same text adds nothing. Topics, sections and the order of the
 * notes that stay are unchanged.
 *
 * @see BUILD_PLAN §10 row 8.5
 */
export function dropDuplicateNotes(
	_topics: readonly PlannedTopic[],
	_existing: readonly NoteContent[]
): Traced<DuplicateSplit> {
	throw new Error('not implemented');
}
