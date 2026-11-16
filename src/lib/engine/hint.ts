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
export function microHint(_spec: ExerciseSpec, _rng: Rng): Traced<MicroHint> {
	throw new Error('not implemented');
}
