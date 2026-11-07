import type { CardId } from '#lib/db/schemas/common.ts';
import type { Traced } from './trace.ts';

/** Another card's answer, for the collision guard. */
export interface OtherAnswer {
	cardId: CardId;
	text: string;
}

/** How a typed answer was judged. @see BUILD_PLAN §6.10 */
export type TypedMatch = 'exact' | 'accepted' | 'fuzzy' | 'collision' | 'none';

/** The verdict on a typed answer. `chosenFromCardId` is set when it was another card's answer. */
export interface TypedVerdict {
	correct: boolean;
	match: TypedMatch;
	/** The normalised typed text, as logged in `chosen`. */
	normalized: string;
	/** Edits to the matched string; null when nothing matched within tolerance. */
	edits: number | null;
	chosenFromCardId?: CardId;
}

/** What `gradeTyped` needs. `others` may include the card itself; it is ignored there. */
export interface TypedInput {
	cardId: CardId;
	typed: string;
	answer: string;
	accepted: readonly string[];
	others: readonly OtherAnswer[];
}

/** The outcome of tapping "I was right — add as accepted". */
export interface AcceptCheck {
	normalized: string;
	/** True when the review may be re-logged as correct. */
	passesGuard: boolean;
	collidesWithCardId?: CardId;
}

/**
 * NFKC, lowercase, trim, collapse whitespace, strip punctuation at word ends.
 *
 * @see BUILD_PLAN §6.10 and Decisions log (normalising)
 */
export function normalizeAnswer(_text: string): string {
	throw new Error('not implemented');
}

/** Length in code points. */
export function textLength(_text: string): number {
	throw new Error('not implemented');
}

/** Edits allowed for an answer of this normalised length. @see FUZZY_EDITS */
export function allowedEdits(_length: number): number {
	throw new Error('not implemented');
}

/** Damerau–Levenshtein, optimal string alignment, over code points. @see BUILD_PLAN §6.10 */
export function osaDistance(_a: string, _b: string): number {
	throw new Error('not implemented');
}

/**
 * Judges a typed answer: exact, accepted, collision guard, then fuzzy.
 *
 * @see BUILD_PLAN §6.10 and Decisions log (typed grading order)
 */
export function gradeTyped(_input: TypedInput): Traced<TypedVerdict> {
	throw new Error('not implemented');
}

/**
 * Checks a string the student wants accepted against the collision guard.
 *
 * @see BUILD_PLAN §6.10 (accept list)
 */
export function checkAccept(
	_cardId: CardId,
	_value: string,
	_others: readonly OtherAnswer[]
): Traced<AcceptCheck> {
	throw new Error('not implemented');
}
