import type { BuildContext, Built } from './exercise-context.ts';

/**
 * `ideaUnit` on a fact `fwd` card with key words: prompt = the term, `answer` = the definition,
 * `keyWords` = the note's key words. A fact without key words falls back to `cloze`.
 *
 * @see BUILD_PLAN §5.1 row ideaUnit; Decisions log "Phase 8.6 Q1"
 */
export function buildIdeaUnit(_ctx: BuildContext): Built {
	throw new Error('not implemented');
}

/**
 * `listAll` (type every item) and `listN` (type `listRequired(M)` items) on a list fact's `fwd`
 * card: `entry: 'type'`, `items` = the key words, no options. Not a list fact → `mc`.
 *
 * @see BUILD_PLAN §5.1 row listN; Decisions log "Phase 8.6 Q9"
 */
export function buildListTyped(_ctx: BuildContext, _kind: 'listAll' | 'listN'): Built {
	throw new Error('not implemented');
}

/**
 * `listPick`: tap `listRequired(M)` of the list's items among them plus up to M − N items of the
 * course's other list facts (never equal to an item after normalising), shuffled with the seeded
 * RNG. No other list items → `listN`.
 *
 * @see Decisions log "Phase 8.6 Q9"; mockup 05
 */
export function buildListPick(_ctx: BuildContext): Built {
	throw new Error('not implemented');
}

/**
 * `listNot` ("Which is NOT one of …?"): a `choose` spec with `MC_OPTIONS − 1` items of the list
 * and one item of another list fact of the course (the correct option). No other list item →
 * `listN`.
 *
 * @see Decisions log "Phase 8.6 Q9"; SESSION_NOTES J
 */
export function buildListNot(_ctx: BuildContext): Built {
	throw new Error('not implemented');
}
