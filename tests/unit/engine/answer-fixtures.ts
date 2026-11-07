import fc from 'fast-check';
import type { CardId } from '#lib/db/schemas/common.ts';
import type { AnswerEntry } from '#lib/engine/answers.ts';
import type { ChoiceInput, ChoiceSet } from '#lib/engine/distractors.ts';
import type { Rng } from '#lib/engine/rng.ts';
import { cardId, noteId, topicId } from './fixtures.ts';

/** Builds an answer entry for card `n`; topic 1, kind `term`, no group or tags by default. */
export function entry(
	n: number,
	text: string,
	overrides: Partial<Omit<AnswerEntry, 'cardId' | 'text'>> = {}
): AnswerEntry {
	return {
		cardId: cardId(n),
		noteId: noteId(n),
		topicId: topicId(1),
		tags: [],
		kind: 'term',
		text,
		...overrides
	};
}

/** A deterministic stand-in for a seeded RNG: cycles through `values` (each in [0, 1)). */
export function fakeRng(values: readonly number[] = [0.13, 0.71, 0.42, 0.97, 0.05, 0.58]): Rng {
	let i = 0;
	return () => {
		const value = values[i % values.length] ?? 0;
		i += 1;
		return value;
	};
}

/** Arbitrary RNG value lists, for properties over many seeds. */
export const rngValues = fc.array(fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }), {
	minLength: 1,
	maxLength: 8
});

export function choiceInput(
	target: AnswerEntry,
	pool: AnswerEntry[],
	overrides: Partial<ChoiceInput> = {}
): ChoiceInput {
	return { target, accepted: [], pool, confusions: new Map(), rng: fakeRng(), ...overrides };
}

export const confusions = (pairs: [number, number][]): Map<CardId, number> =>
	new Map(pairs.map(([n, count]) => [cardId(n), count]));

/** Option card IDs, sorted so the seeded order doesn't matter. */
export const optionIds = (set: ChoiceSet): CardId[] => set.options.map((o) => o.cardId).sort();

export const ids = (...ns: number[]): CardId[] => ns.map(cardId).sort();
