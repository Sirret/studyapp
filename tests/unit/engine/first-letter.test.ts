import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BANK_SIZE, FIRST_LETTER_LENGTH_DELTA } from '#lib/config/defaults.ts';
import { firstLetterBank } from '#lib/engine/distractors.ts';
import {
	choiceInput,
	confusions,
	entry,
	fakeRng,
	ids,
	optionIds,
	rngValues
} from './answer-fixtures.ts';
import { cardId, NUM_RUNS, topicId } from './fixtures.ts';

const bankFor = (...args: Parameters<typeof choiceInput>) =>
	firstLetterBank(choiceInput(...args)).result;

/** "s" followed by `fill` repeated, to a total length of `length`. */
const sWord = (length: number, fill: string) => 's' + fill.repeat(length - 1);

/** @see BUILD_PLAN §6.10 (first-letter mode) and Decisions log (first-letter ranking) */
describe('firstLetterBank', () => {
	const target = entry(1, 'Stack'); // normalised length 5

	it('gives the first letter of the normalised answer', () => {
		expect(bankFor(entry(1, '(Stack)'), []).letter).toBe('s');
		expect(bankFor(target, []).letter).toBe('s');
	});

	it('gives a bank of BANK_SIZE options, all starting with that letter', () => {
		const pool = [
			entry(10, 'Set'),
			entry(11, 'Sort'),
			entry(12, 'Splay'),
			entry(13, 'Shell'),
			entry(14, 'Queue'),
			entry(15, 'Heap')
		];
		const { letter, bank } = bankFor(target, pool);
		expect(letter).toBe('s');
		expect(bank).not.toBeNull();
		expect(bank?.options).toHaveLength(BANK_SIZE);
		bank?.options.forEach((o) => expect(o.text.toLowerCase().startsWith('s')).toBe(true));
		// Ranked by length difference: Splay, Shell (0), Sort (1) beat Set (2).
		expect(bank && optionIds(bank)).toEqual(ids(1, 11, 12, 13));
	});

	it('shows the letter only when fewer than BANK_SIZE − 1 candidates qualify', () => {
		// Two "s" candidates (Queue doesn't qualify); BANK_SIZE − 1 are needed.
		const pool = [entry(10, 'Set'), entry(11, 'Sort'), entry(14, 'Queue')];
		expect(bankFor(target, pool)).toEqual({ letter: 's', bank: null });
		expect(bankFor(target, [])).toEqual({ letter: 's', bank: null });
	});

	it('keeps lengths within ±FIRST_LETTER_LENGTH_DELTA (boundary included)', () => {
		const len = 5;
		const atHigh = entry(20, sWord(len + FIRST_LETTER_LENGTH_DELTA, 'a'));
		const atLow = entry(21, sWord(len - FIRST_LETTER_LENGTH_DELTA, 'b'));
		const overHigh = entry(22, sWord(len + FIRST_LETTER_LENGTH_DELTA + 1, 'c'));
		const underLow = entry(23, sWord(Math.max(1, len - FIRST_LETTER_LENGTH_DELTA - 1), 'd'));
		// Only two qualify, so the out-of-range words must not make up a bank.
		expect(bankFor(target, [atHigh, atLow, overHigh, underLow]).bank).toBeNull();
		const withShell = bankFor(target, [atHigh, atLow, overHigh, underLow, entry(24, 'Shell')]);
		expect(withShell.bank && optionIds(withShell.bank)).toEqual(ids(1, 20, 21, 24));
	});

	it('only draws answers of the same kind', () => {
		const pool = [
			entry(10, 'Sort'),
			entry(11, 'Splay'),
			entry(12, 'Store it', { kind: 'definition' }),
			entry(13, 'Start', { kind: 'step' })
		];
		expect(bankFor(target, pool).bank).toBeNull();
	});

	it('excludes accepted synonyms, the answer’s duplicates and duplicate texts', () => {
		const pool = [
			entry(10, 'Splay'),
			entry(11, 'splay!'),
			entry(12, 'Shell'),
			entry(13, 'stacks'),
			entry(14, 'stack')
		];
		// Unique, allowed candidates: splay, shell → fewer than BANK_SIZE − 1.
		expect(bankFor(target, pool, { accepted: ['Stacks'] }).bank).toBeNull();
	});

	it('checks the letter on the normalised candidate text', () => {
		const pool = [entry(10, '"Splay"'), entry(11, 'Shell'), entry(12, 'Sort')];
		const { bank } = bankFor(target, pool);
		expect(bank && optionIds(bank)).toEqual(ids(1, 10, 11, 12));
	});

	it('ranks by confusion, then length difference, ignoring distractor tiers', () => {
		const sibling = { ...target, group: 'ds' };
		const pool = [
			entry(10, 'Set', { group: 'ds' }),
			entry(11, 'Sort'),
			entry(12, 'Splay', { topicId: topicId(5) }),
			entry(13, 'Shell', { topicId: topicId(5) }),
			entry(15, 'Sieve', { topicId: topicId(5) })
		];
		const { bank } = bankFor(sibling, pool, { confusions: confusions([[15, 4]]) });
		expect(bank && optionIds(bank)).toEqual(ids(1, 12, 13, 15));
	});

	it('breaks length ties by card ID', () => {
		const pool = [entry(17, 'Sorts'), entry(13, 'Shell'), entry(16, 'Sigma'), entry(12, 'Splay')];
		const { bank } = bankFor(target, pool);
		expect(bank && optionIds(bank)).toEqual(ids(1, 12, 13, 16));
	});

	const pool = [entry(11, 'Sort'), entry(12, 'Splay'), entry(13, 'Shell'), entry(16, 'Sigma')];

	it('puts correctIndex on the target’s text', () => {
		fc.assert(
			fc.property(rngValues, (values) => {
				const { bank } = bankFor(target, pool, { rng: fakeRng(values) });
				expect(bank).not.toBeNull();
				if (bank)
					expect(bank.options[bank.correctIndex]).toEqual({ text: 'Stack', cardId: cardId(1) });
			}),
			{ numRuns: NUM_RUNS }
		);
	});

	it('is deterministic: the same seed gives an identical result and trace', () => {
		fc.assert(
			fc.property(rngValues, (values) => {
				const a = firstLetterBank(choiceInput(target, pool, { rng: fakeRng(values) }));
				const b = firstLetterBank(choiceInput(target, pool, { rng: fakeRng(values) }));
				expect(a).toEqual(b);
			}),
			{ numRuns: NUM_RUNS }
		);
	});
});
