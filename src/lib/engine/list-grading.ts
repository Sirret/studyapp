import type { ExerciseKind } from '#lib/db/schemas/common.ts';
import type { Traced } from './trace.ts';

/** A list grade. @see Decisions log "Phase 8.6 Q9" */
export interface ListGrade {
	correct: boolean;
	/** Item indexes the answer named (each counted once), ascending. */
	valid: number[];
	/** Entry indexes (typed) or option indexes (picked) that are not items of the list, ascending. */
	wrong: number[];
	/** The N the answer needed. */
	required: number;
}

/**
 * N for "name N of M": `ceil(itemCount × LIST_N_SHARE)`, at least `LIST_N_MIN`, at most `itemCount`.
 *
 * @see Decisions log "Phase 8.6 Q9"
 */
export function listRequired(_itemCount: number): number {
	throw new Error('not implemented');
}

/**
 * The path of a list fact's card: `listAll` alone when the list has at most `LIST_ALL_ONLY_MAX`
 * items; otherwise `listPick`, `listNot`, `listN`, `listAll` (recognition first, then recall, like
 * other paths). Never a reverse card (cardgen).
 *
 * @see Decisions log "Phase 8.6 Q9"; SESSION_NOTES D4, J
 */
export function listPath(_itemCount: number): ExerciseKind[] {
	throw new Error('not implemented');
}

/**
 * Grades typed list entries: each non-empty entry is matched to an item with `gradeTyped` (exact,
 * accepted or fuzzy, collision-guarded against the list's other items); an item named twice counts
 * once; an entry matching no item is `wrong`. Correct when `valid.length >= required`; wrong
 * entries don't make it incorrect on their own.
 *
 * @see BUILD_PLAN §5.1 row listN ("validItems >= requiredItems")
 */
export function gradeListTyped(_input: {
	cardId: string;
	items: readonly string[];
	typed: readonly string[];
	required: number;
}): Traced<ListGrade> {
	throw new Error('not implemented');
}

/**
 * Grades picked options: correct when no pick is wrong and at least `required` correct options are
 * picked ("Tap four. Two of these are not …", mockup 05).
 *
 * @see Decisions log "Phase 8.6 Q9"
 */
export function gradeListPicked(_input: {
	correct: readonly number[];
	picked: readonly number[];
	required: number;
}): Traced<ListGrade> {
	throw new Error('not implemented');
}
