import { MC_OPTIONS } from '#lib/config/defaults.ts';
import { baseOf, fallback, shuffled, type BuildContext, type Built } from './exercise-context.ts';
import type { ExerciseNote } from './exercise-types.ts';
import { normalizeAnswer } from './grading.ts';
import { listRequired } from './list-grading.ts';
import { compareText } from './replay.ts';
import { shuffle } from './rng.ts';

/** The note's key words when it is a fact with any, else null. */
function keyWordsOf(note: ExerciseNote): string[] | null {
	if (note.type !== 'fact') return null;
	const keyWords = note.payload.keyWords ?? [];
	return keyWords.length > 0 ? keyWords : null;
}

/** The items of a list fact, else null. */
function listItems(note: ExerciseNote): string[] | null {
	return note.type === 'fact' && note.payload.list === true ? keyWordsOf(note) : null;
}

/**
 * Items of the course's other list facts, in a stable order (same topic first, then note order),
 * once each, never equal to one of `own` after normalising.
 */
function otherListItems(ctx: BuildContext, own: readonly string[]): string[] {
	const seen = new Set(own.map(normalizeAnswer));
	const out: string[] = [];
	const notes = [...ctx.input.course.notes.values()]
		.filter((note) => note.id !== ctx.note.id && listItems(note))
		.sort(
			(a, b) =>
				Number(a.topicId !== ctx.note.topicId) - Number(b.topicId !== ctx.note.topicId) ||
				compareText(a.topicId, b.topicId) ||
				a.order - b.order ||
				compareText(a.id, b.id)
		);
	for (const note of notes) {
		for (const item of listItems(note) ?? []) {
			const norm = normalizeAnswer(item);
			if (norm === '' || seen.has(norm)) continue;
			seen.add(norm);
			out.push(item.trim());
		}
	}
	return out;
}

/**
 * `ideaUnit` on a fact `fwd` card with key words: prompt = the term, `answer` = the definition,
 * `keyWords` = the note's key words. A fact without key words falls back to `cloze`.
 *
 * @see BUILD_PLAN §5.1 row ideaUnit; Decisions log "Phase 8.6 Q1"
 */
export function buildIdeaUnit(ctx: BuildContext): Built {
	const keyWords = keyWordsOf(ctx.note);
	if (!keyWords || ctx.note.type !== 'fact' || ctx.input.card.variant !== 'fwd') {
		return fallback('cloze', 'ideaUnit needs a fact fwd card with key words');
	}
	return {
		...baseOf(ctx, 'ideaUnit'),
		shape: 'ideaUnit',
		answer: ctx.note.payload.definition,
		keyWords: [...keyWords]
	};
}

/**
 * `listAll` (type every item) and `listN` (type `listRequired(M)` items) on a list fact's `fwd`
 * card: `entry: 'type'`, `items` = the key words, no options. Not a list fact → `mc`.
 *
 * @see BUILD_PLAN §5.1 row listN; Decisions log "Phase 8.6 Q9"
 */
export function buildListTyped(ctx: BuildContext, kind: 'listAll' | 'listN'): Built {
	const items = listItems(ctx.note);
	if (!items) return fallback('mc', `${kind} needs a list fact`);
	const required = kind === 'listAll' ? items.length : listRequired(items.length);
	const base = baseOf(ctx, kind);
	return {
		...base,
		instruction: kind === 'listAll' ? 'Name every item' : `Name any ${required}`,
		shape: 'list',
		entry: 'type',
		items: [...items],
		required,
		options: [],
		correct: []
	};
}

/**
 * `listPick`: tap `listRequired(M)` of the list's items among them plus up to M − N items of the
 * course's other list facts (never equal to an item after normalising), shuffled with the seeded
 * RNG. No other list items → `listN`.
 *
 * @see Decisions log "Phase 8.6 Q9"; mockup 05
 */
export function buildListPick(ctx: BuildContext): Built {
	const items = listItems(ctx.note);
	if (!items) return fallback('mc', 'listPick needs a list fact');
	const others = otherListItems(ctx, items);
	if (others.length === 0) return fallback('listN', 'no other list items to mix in');
	const required = listRequired(items.length);
	const wrong = shuffle(others, ctx.rng).slice(0, Math.max(1, items.length - required));
	const { items: texts, at } = shuffled([...items, ...wrong], ctx.rng);
	return {
		...baseOf(ctx, 'listPick'),
		instruction: `Tap ${required} that belong`,
		shape: 'list',
		entry: 'pick',
		items: [...items],
		required,
		options: texts.map((text) => ({ text })),
		correct: items.map((_item, i) => at[i] ?? 0).sort((a, b) => a - b)
	};
}

/**
 * `listNot` ("Which is NOT one of …?"): a `choose` spec with `MC_OPTIONS − 1` items of the list
 * and one item of another list fact of the course (the correct option). No other list item →
 * `listN`.
 *
 * @see Decisions log "Phase 8.6 Q9"; SESSION_NOTES J
 */
export function buildListNot(ctx: BuildContext): Built {
	const items = listItems(ctx.note);
	if (!items || ctx.note.type !== 'fact') return fallback('mc', 'listNot needs a list fact');
	const others = otherListItems(ctx, items);
	const outsider = shuffle(others, ctx.rng)[0];
	if (outsider === undefined) return fallback('listN', 'no other list item');
	const inside = shuffle(items, ctx.rng).slice(0, MC_OPTIONS - 1);
	const { items: texts, at } = shuffled([outsider, ...inside], ctx.rng);
	return {
		...baseOf(ctx, 'listNot', `Which is NOT one of: ${ctx.note.payload.term}?`),
		instruction: 'Pick the one that doesn’t belong',
		shape: 'choose',
		options: texts.map((text) => ({ text })),
		correctIndex: at[0] ?? 0,
		letter: null
	};
}
