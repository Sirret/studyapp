import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FUZZY_EDITS } from '#lib/config/defaults.ts';
import { allowedEdits, normalizeAnswer, osaDistance, textLength } from '#lib/engine/grading.ts';
import { NUM_RUNS } from './fixtures.ts';

/** @see BUILD_PLAN §6.10 (normalise) and Decisions log (normalising) */
describe('normalizeAnswer', () => {
	it('applies Unicode NFKC (ligatures, full-width letters)', () => {
		expect(normalizeAnswer('ﬁle')).toBe('file');
		expect(normalizeAnswer('ＴＣＰ')).toBe('tcp');
	});

	it('lowercases', () => {
		expect(normalizeAnswer('Binary Search TREE')).toBe('binary search tree');
	});

	it('trims and collapses whitespace (spaces, tabs, newlines)', () => {
		expect(normalizeAnswer('  binary   search\ttree \n')).toBe('binary search tree');
	});

	it('strips punctuation from the ends of each word', () => {
		expect(normalizeAnswer('Hello, world!')).toBe('hello world');
		expect(normalizeAnswer('(stack)')).toBe('stack');
		expect(normalizeAnswer('"queue"')).toBe('queue');
		expect(normalizeAnswer('first-in, first-out.')).toBe('first-in first-out');
	});

	it('keeps a trailing + or # (C++, C#)', () => {
		expect(normalizeAnswer('C++')).toBe('c++');
		expect(normalizeAnswer('C#')).toBe('c#');
	});

	it('keeps C++ and C# at the end of a sentence, stripping only the final full stop', () => {
		expect(normalizeAnswer('I use C++.')).toBe('i use c++');
		expect(normalizeAnswer('Written in C#!')).toBe('written in c#');
	});

	it('keeps a leading . before a letter or digit (.NET)', () => {
		expect(normalizeAnswer('.NET')).toBe('.net');
		expect(normalizeAnswer('the .NET runtime')).toBe('the .net runtime');
	});

	it('keeps punctuation inside a word (TCP/IP, 802.11, 3NF)', () => {
		expect(normalizeAnswer('TCP/IP')).toBe('tcp/ip');
		expect(normalizeAnswer('802.11')).toBe('802.11');
		expect(normalizeAnswer('3NF')).toBe('3nf');
		expect(normalizeAnswer('(TCP/IP)')).toBe('tcp/ip');
	});

	it('drops a word made only of punctuation and collapses the gap', () => {
		// SPEC-GAP: the spec strips punctuation at word ends; a word of only punctuation
		// becomes empty — read as vanishing, leaving single spaces.
		expect(normalizeAnswer('stack - queue')).toBe('stack queue');
	});

	it('gives the empty string for blank input', () => {
		expect(normalizeAnswer('   \t ')).toBe('');
	});

	it('is idempotent', () => {
		fc.assert(
			fc.property(fc.string(), (s) => {
				const once = normalizeAnswer(s);
				expect(normalizeAnswer(once)).toBe(once);
			}),
			{ numRuns: NUM_RUNS }
		);
	});
});

/** @see BUILD_PLAN Decisions log (lengths are counted in code points) */
describe('textLength', () => {
	it('counts code points, not UTF-16 units', () => {
		expect(textLength('stack')).toBe(5);
		expect(textLength('\u{1F600}')).toBe(1);
		expect(textLength('a\u{1F600}b')).toBe(3);
		expect(textLength('')).toBe(0);
	});

	it('counts symbols kept by normalising (C++)', () => {
		expect(textLength(normalizeAnswer('C++'))).toBe(3);
	});
});

/** @see BUILD_PLAN §6.10 (fuzzy match) and FUZZY_EDITS */
describe('allowedEdits', () => {
	const [exact, one, two] = FUZZY_EDITS;

	it('allows no edits up to the first threshold (4 chars)', () => {
		expect(allowedEdits(0)).toBe(exact.edits);
		expect(allowedEdits(1)).toBe(exact.edits);
		expect(allowedEdits(exact.upTo)).toBe(exact.edits);
	});

	it('allows one edit from just above the first threshold to the second (5–8 chars)', () => {
		expect(allowedEdits(exact.upTo + 1)).toBe(one.edits);
		expect(allowedEdits(one.upTo)).toBe(one.edits);
	});

	it('allows two edits above the second threshold (≥ 9 chars)', () => {
		expect(allowedEdits(one.upTo + 1)).toBe(two.edits);
		expect(allowedEdits(100)).toBe(two.edits);
	});

	it('matches the spec values 4→0, 5→1, 8→1, 9→2', () => {
		expect([4, 5, 8, 9].map(allowedEdits)).toEqual([exact.edits, one.edits, one.edits, two.edits]);
	});
});

/** @see BUILD_PLAN §6.10 (Damerau–Levenshtein, optimal string alignment) */
describe('osaDistance', () => {
	it('is 0 for equal strings', () => {
		expect(osaDistance('stack', 'stack')).toBe(0);
		expect(osaDistance('', '')).toBe(0);
	});

	it('counts substitutions, insertions and deletions as one edit each', () => {
		expect(osaDistance('stack', 'stick')).toBe(1);
		expect(osaDistance('stack', 'stacks')).toBe(1);
		expect(osaDistance('stack', 'tack')).toBe(1);
		expect(osaDistance('', 'abc')).toBe(3);
	});

	it('counts an adjacent transposition as one edit', () => {
		expect(osaDistance('ab', 'ba')).toBe(1);
		expect(osaDistance('receive', 'recieve')).toBe(1);
		expect(osaDistance('recursion', 'ercrusion')).toBe(2);
	});

	it('uses optimal string alignment, not unrestricted Damerau–Levenshtein', () => {
		// OSA can't edit a substring twice: "ca" → "abc" is 3 (unrestricted DL gives 2).
		expect(osaDistance('ca', 'abc')).toBe(3);
	});

	it('works over code points', () => {
		expect(osaDistance('\u{1F600}a', 'a')).toBe(1);
		expect(osaDistance('\u{1F600}', '\u{1F601}')).toBe(1);
	});

	it('is symmetric and bounded by the longer length', () => {
		fc.assert(
			fc.property(fc.string({ maxLength: 12 }), fc.string({ maxLength: 12 }), (a, b) => {
				const d = osaDistance(a, b);
				expect(osaDistance(b, a)).toBe(d);
				expect(d).toBeLessThanOrEqual(Math.max(textLength(a), textLength(b)));
				expect(d === 0).toBe(a === b);
			}),
			{ numRuns: NUM_RUNS }
		);
	});
});
