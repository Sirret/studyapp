import { FUZZY_EDITS } from '#lib/config/defaults.ts';
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

/** Punctuation or a symbol: stripped from the ends of a word. */
const EDGE_MARK = /^[\p{P}\p{S}]$/u;
/** Kept at the end of a word: C++, C#. */
const KEEP_TRAILING = /^[+#]$/u;
const LETTER_OR_DIGIT = /^[\p{L}\p{N}]$/u;

const stripsAtEnd = (char: string) => EDGE_MARK.test(char) && !KEEP_TRAILING.test(char);

/** True when `chars[i]` is stripped from the start: not a `.` before a letter or digit (.NET). */
function stripsAtStart(chars: readonly string[], i: number): boolean {
	const char = chars[i] ?? '';
	const keepDot = char === '.' && LETTER_OR_DIGIT.test(chars[i + 1] ?? '');
	return EDGE_MARK.test(char) && !keepDot;
}

/** Strips punctuation from both ends of one word, keeping C++, C# and .NET. */
function trimWord(word: string): string {
	const chars = [...word];
	let end = chars.length;
	while (end > 0 && stripsAtEnd(chars[end - 1] ?? '')) end -= 1;
	let start = 0;
	while (start < end && stripsAtStart(chars, start)) start += 1;
	return chars.slice(start, end).join('');
}

/**
 * NFKC, lowercase, trim, collapse whitespace, strip punctuation at word ends.
 *
 * @see BUILD_PLAN §6.10 and Decisions log (normalising)
 */
export function normalizeAnswer(text: string): string {
	return text
		.normalize('NFKC')
		.toLowerCase()
		.split(/\s+/u)
		.map(trimWord)
		.filter((word) => word !== '')
		.join(' ');
}

/** Length in code points. */
export function textLength(text: string): number {
	return [...text].length;
}

/** Edits allowed for an answer of this normalised length. @see FUZZY_EDITS */
export function allowedEdits(length: number): number {
	const band = FUZZY_EDITS.find((candidate) => length <= candidate.upTo);
	return band?.edits ?? 0;
}

/** Damerau–Levenshtein, optimal string alignment, over code points. @see BUILD_PLAN §6.10 */
export function osaDistance(a: string, b: string): number {
	const x = [...a];
	const y = [...b];
	const d = Array.from({ length: x.length + 1 }, (_row, i) =>
		Array.from({ length: y.length + 1 }, (_cell, j) => (i === 0 ? j : j === 0 ? i : 0))
	);
	for (let i = 1; i <= x.length; i += 1) {
		const row = d[i] as number[];
		const above = d[i - 1] as number[];
		for (let j = 1; j <= y.length; j += 1) {
			const cost = x[i - 1] === y[j - 1] ? 0 : 1;
			let best = Math.min(
				(above[j] as number) + 1,
				(row[j - 1] as number) + 1,
				(above[j - 1] as number) + cost
			);
			if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) {
				best = Math.min(best, ((d[i - 2] as number[])[j - 2] as number) + 1);
			}
			row[j] = best;
		}
	}
	return (d[x.length] as number[])[y.length] as number;
}

/** Other cards' answers, normalised, without the card itself or empty texts. */
function normalizedOthers(cardId: CardId, others: readonly OtherAnswer[]): OtherAnswer[] {
	return others
		.filter((other) => other.cardId !== cardId)
		.map((other) => ({ cardId: other.cardId, text: normalizeAnswer(other.text) }))
		.filter((other) => other.text !== '');
}

/** The smallest edit count to a target within that target's tolerance, or null. */
function fuzzyEdits(typed: string, targets: readonly string[]): number | null {
	let best: number | null = null;
	for (const target of targets) {
		const edits = osaDistance(typed, target);
		const fits = edits <= allowedEdits(textLength(target));
		if (fits && (best === null || edits < best)) best = edits;
	}
	return best;
}

function judge(input: TypedInput, normalized: string): TypedVerdict {
	const answer = normalizeAnswer(input.answer);
	if (normalized === '') return { correct: false, match: 'none', normalized, edits: null };
	if (normalized === answer) return { correct: true, match: 'exact', normalized, edits: 0 };
	const others = normalizedOthers(input.cardId, input.others);
	const collides = (text: string) => others.some((other) => other.text === text);
	const accepted = input.accepted
		.map(normalizeAnswer)
		.filter((text) => text !== '' && !collides(text));
	if (accepted.includes(normalized)) {
		return { correct: true, match: 'accepted', normalized, edits: 0 };
	}
	const hit = others.find((other) => other.text === normalized);
	if (hit) {
		return {
			correct: false,
			match: 'collision',
			normalized,
			edits: null,
			chosenFromCardId: hit.cardId
		};
	}
	const edits = fuzzyEdits(normalized, [answer, ...accepted]);
	if (edits !== null) return { correct: true, match: 'fuzzy', normalized, edits };
	return { correct: false, match: 'none', normalized, edits: null };
}

/**
 * Judges a typed answer: exact, accepted, collision guard, then fuzzy.
 *
 * @see BUILD_PLAN §6.10 and Decisions log (typed grading order)
 */
export function gradeTyped(input: TypedInput): Traced<TypedVerdict> {
	const result = judge(input, normalizeAnswer(input.typed));
	return {
		result,
		trace: [
			{
				rule: 'typed-grade',
				match: result.match,
				edits: result.edits,
				chosenFromCardId: result.chosenFromCardId ?? null
			}
		]
	};
}

/**
 * Checks a string the student wants accepted against the collision guard.
 *
 * @see BUILD_PLAN §6.10 (accept list)
 */
export function checkAccept(
	cardId: CardId,
	value: string,
	others: readonly OtherAnswer[]
): Traced<AcceptCheck> {
	const normalized = normalizeAnswer(value);
	const hit = normalizedOthers(cardId, others).find((other) => other.text === normalized);
	let result: AcceptCheck;
	if (normalized === '') result = { normalized, passesGuard: false };
	else if (hit) result = { normalized, passesGuard: false, collidesWithCardId: hit.cardId };
	else result = { normalized, passesGuard: true };
	return {
		result,
		trace: [
			{
				rule: 'accept-guard',
				passesGuard: result.passesGuard,
				collidesWithCardId: hit?.cardId ?? null
			}
		]
	};
}
