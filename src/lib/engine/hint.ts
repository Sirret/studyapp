import { HINT_LETTERS, HINT_WORDS } from '#lib/config/defaults.ts';
import type { ExerciseSpec } from './exercise-types.ts';
import type { Rng } from './rng.ts';
import type { Traced } from './trace.ts';

/** What a micro hint shows. @see Decisions log "Phase 8.6 Q10" */
export type MicroHint =
	/** Text revealed above the input. */
	| { kind: 'reveal'; text: string }
	/** A wrong option removed from a choice. */
	| { kind: 'remove'; index: number }
	/** This shape has no hint. */
	| { kind: 'none' };

const ELLIPSIS = '…';

const wordsOf = (text: string) =>
	text
		.trim()
		.split(/\s+/u)
		.filter((word) => word !== '');

/** The first `HINT_LETTERS` letters (one, for a short word), the rest as "_". */
function maskWord(word: string): string {
	const chars = [...word];
	const shown = chars.length > HINT_LETTERS ? HINT_LETTERS : 1;
	return chars.slice(0, shown).join('') + '_'.repeat(chars.length - shown);
}

/** A typed answer: its first words then "…" when long, else every word masked. */
function typedHint(answer: string): string {
	const words = wordsOf(answer);
	if (words.length > HINT_WORDS) return `${words.slice(0, HINT_WORDS).join(' ')} ${ELLIPSIS}`;
	return words.map(maskWord).join(' ');
}

/**
 * A list: its first `HINT_WORDS` words, items joined by ", ", then "…". Never every word of the
 * list (WIP "not yet in the docs": a hint that names the whole answer is no hint).
 */
function listHint(items: readonly string[]): string {
	const total = items.reduce((sum, item) => sum + wordsOf(item).length, 0);
	let left = Math.min(HINT_WORDS, Math.max(0, total - 1));
	const parts: string[] = [];
	for (const item of items) {
		if (left === 0) break;
		const words = wordsOf(item).slice(0, left);
		left -= words.length;
		if (words.length > 0) parts.push(words.join(' '));
	}
	return parts.length === 0 ? ELLIPSIS : `${parts.join(', ')}, ${ELLIPSIS}`;
}

type HintOf<S extends ExerciseSpec['shape']> = (
	spec: Extract<ExerciseSpec, { shape: S }>,
	rng: Rng
) => MicroHint;

const NONE: MicroHint = { kind: 'none' };

/** Removes one wrong option, picked with the rng. */
function removeOne(options: readonly unknown[], correctIndex: number, rng: Rng): MicroHint {
	const wrong = options.map((_o, i) => i).filter((i) => i !== correctIndex);
	const index = wrong[Math.floor(rng() * wrong.length)];
	return index === undefined ? NONE : { kind: 'remove', index };
}

/** One hint rule per shape; the mapped type keeps it exhaustive. */
const HINTS: { readonly [S in ExerciseSpec['shape']]: HintOf<S> } = {
	type: (spec) => ({ kind: 'reveal', text: typedHint(spec.answer) }),
	ideaUnit: (spec) => ({ kind: 'reveal', text: typedHint(spec.answer) }),
	list: (spec) => ({ kind: 'reveal', text: listHint(spec.items) }),
	choose: (spec, rng) => removeOne(spec.options, spec.correctIndex, rng),
	chooseMany: () => NONE,
	order: () => NONE,
	pair: () => NONE,
	sort: () => NONE,
	selfRate: () => NONE,
	study: () => NONE
};

/**
 * The micro hint for a spec (one per attempt; the answer is then logged `hinted: true`):
 * - `type` and `ideaUnit`: an answer of more than `HINT_WORDS` words → its first `HINT_WORDS`
 *   words then "…"; otherwise the first `HINT_LETTERS` letters of each word, the rest of each word
 *   as "_" (a word no longer than `HINT_LETTERS` shows its first letter only).
 * - `list`: its first `HINT_WORDS` items' words, i.e. the first `HINT_WORDS` words of the items
 *   joined by ", ", then "…".
 * - `choose`: removes one wrong option, picked with `rng`.
 * - every other shape: `none`.
 *
 * @see SESSION_NOTES J (micro hint); Decisions log "Phase 8.6 Q10"
 */
export function microHint(spec: ExerciseSpec, rng: Rng): Traced<MicroHint> {
	const hint = HINTS[spec.shape] as HintOf<typeof spec.shape>;
	const result = hint(spec as never, rng);
	return { result, trace: [{ rule: 'hint.micro', shape: spec.shape, hint: result.kind }] };
}
