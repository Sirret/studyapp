import { describe, expect, it } from 'vitest';
import type { ExerciseKind } from '#lib/db/schemas/common.ts';
import { missesToRetry, nextDeckPass, quickQuiz, type PracticeCard } from '#lib/engine/practice.ts';
import { cardId, deepFreeze } from './fixtures.ts';

/**
 * Practice: the quick quiz, its retry round and the flashcard deck passes.
 *
 * @see SESSION_NOTES §C, J; Decisions log "Phase 8.6 Q4" and "Q18"
 */

const card = (n: number, path: ExerciseKind[]): PracticeCard => ({ id: cardId(n), path });
const c = cardId;

describe('quickQuiz', () => {
	it('asks every card once, in the given order', () => {
		const cards = [card(1, ['mc', 'cloze']), card(2, ['mc', 'cloze']), card(3, ['cloze'])];
		const { result } = quickQuiz(cards);
		expect(result.map((q) => q.id)).toEqual([c(1), c(2), c(3)]);
	});

	it('rotates the format through the card path by position', () => {
		const cards = [1, 2, 3, 4, 5].map((n) => card(n, ['mc', 'cloze']));
		const { result } = quickQuiz(cards);
		expect(result.map((q) => q.kind)).toEqual(['mc', 'cloze', 'mc', 'cloze', 'mc']);
	});

	it('ignores pathStep gating: a later kind of the path can come up for any card', () => {
		const { result } = quickQuiz([card(1, ['mc', 'cloze']), card(2, ['mc', 'cloze'])]);
		expect(result[1]?.kind).toBe('cloze');
	});

	it('skips self-rated kinds when rotating', () => {
		const { result } = quickQuiz([card(1, ['flip', 'mc']), card(2, ['flip', 'mc'])]);
		expect(result.map((q) => q.kind)).toEqual(['mc', 'mc']);
	});

	it('skips none-weight kinds when rotating', () => {
		const { result } = quickQuiz([
			card(1, ['pretest', 'matching', 'cloze']),
			card(2, ['pretest', 'matching', 'cloze'])
		]);
		expect(result.map((q) => q.kind)).toEqual(['cloze', 'cloze']);
	});

	it('leaves out a card with no usable kind', () => {
		const { result } = quickQuiz([card(1, ['flip']), card(2, ['pretest']), card(3, ['cloze'])]);
		expect(result.map((q) => q.id)).toEqual([c(3)]);
		expect(result[0]?.kind).toBe('cloze');
	});

	it('uses only kinds of the card path', () => {
		const cards = [card(1, ['mc', 'cloze']), card(2, ['sequence']), card(3, ['whichOne', 'cloze'])];
		const { result } = quickQuiz(cards);
		for (const q of result) {
			expect(cards.find((x) => x.id === q.id)?.path).toContain(q.kind);
		}
	});

	it('returns nothing for no cards', () => {
		expect(quickQuiz([]).result).toEqual([]);
	});

	it('is deterministic, does not change its input and returns a trace array', () => {
		const cards = deepFreeze([card(1, ['mc', 'cloze']), card(2, ['mc', 'cloze'])]);
		const a = quickQuiz(cards);
		expect(quickQuiz(cards)).toEqual(a);
		expect(Array.isArray(a.trace)).toBe(true);
	});
});

describe('missesToRetry', () => {
	it('returns the wrong cards, in the order first missed', () => {
		const answers = [
			{ id: c(3), correct: false },
			{ id: c(1), correct: true },
			{ id: c(2), correct: false }
		];
		expect(missesToRetry(answers)).toEqual([c(3), c(2)]);
	});

	it('returns each missed card once even if missed several times', () => {
		const answers = [
			{ id: c(1), correct: false },
			{ id: c(2), correct: false },
			{ id: c(1), correct: false }
		];
		expect(missesToRetry(answers)).toEqual([c(1), c(2)]);
	});

	it('still returns a card answered right later in the round', () => {
		const answers = [
			{ id: c(1), correct: false },
			{ id: c(1), correct: true }
		];
		expect(missesToRetry(answers)).toEqual([c(1)]);
	});

	it('returns nothing when everything was right, or for no answers', () => {
		expect(missesToRetry([{ id: c(1), correct: true }])).toEqual([]);
		expect(missesToRetry([])).toEqual([]);
	});
});

describe('nextDeckPass', () => {
	it('keeps the "Still learning" cards, in the order they were swiped', () => {
		const swipes = [
			{ id: c(4), know: false },
			{ id: c(1), know: true },
			{ id: c(2), know: false },
			{ id: c(3), know: true }
		];
		expect(nextDeckPass(swipes)).toEqual([c(4), c(2)]);
	});

	it('is empty when every card is known, or for no swipes', () => {
		expect(nextDeckPass([{ id: c(1), know: true }])).toEqual([]);
		expect(nextDeckPass([])).toEqual([]);
	});

	it('keeps every card when none is known', () => {
		expect(
			nextDeckPass([
				{ id: c(2), know: false },
				{ id: c(1), know: false }
			])
		).toEqual([c(2), c(1)]);
	});
});
