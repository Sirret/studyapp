import type { Weight } from '#lib/db/schemas/common.ts';
import type { Traced } from './trace.ts';

/** An idea-unit grade. @see Decisions log "Phase 8.6 Q1" */
export interface IdeaUnitGrade {
	/** Every key word is ticked. */
	correct: boolean;
	/** `full` when every tick was a pre-tick; `recognition` when the student ticked one themselves. */
	weight: Weight;
	/** Key word indexes the typed text matches (what the app pre-ticked). */
	preTicked: number[];
	/** Key word indexes left unticked, ascending. */
	missing: number[];
}

/**
 * The key words the typed text holds, as ascending indexes: a key word matches when its
 * normalised form (`normalizeAnswer`) appears in the normalised typed text as whole words, or a
 * fuzzy match within `allowedEdits` of the key word's length. These are pre-ticked for the student.
 *
 * @see SESSION_NOTES D3 ("the app pre-ticks keyword matches") and BUILD_PLAN §5.1 row ideaUnit
 */
export function matchKeyWords(_typed: string, _keyWords: readonly string[]): Traced<number[]> {
	throw new Error('not implemented');
}

/**
 * Grades an idea-unit answer: correct when every key word index is in `ticked`; weight `full` when
 * every ticked index is also pre-ticked (`matchKeyWords(typed, keyWords)`), else `recognition`.
 * Out-of-range or repeated ticks are ignored. A note with no key words can't be graded this way
 * (throws; the builder falls back to `cloze`).
 *
 * @see BUILD_PLAN §5.1 row ideaUnit and Decisions log "Phase 8.6 Q1"
 */
export function gradeIdeaUnit(_input: {
	typed: string;
	keyWords: readonly string[];
	ticked: readonly number[];
}): Traced<IdeaUnitGrade> {
	throw new Error('not implemented');
}
