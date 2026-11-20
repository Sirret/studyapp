import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { gradeIdeaUnit, matchKeyWords } from '#lib/engine/idea-unit.ts';
import { NUM_RUNS } from './fixtures.ts';

/**
 * Idea-unit grading: the student types a definition, then ticks the key words it holds; the app
 * pre-ticks the key words the typed text matches.
 *
 * @see BUILD_PLAN §5.1 row ideaUnit; SESSION_NOTES D3; Decisions log "Phase 8.6 Q1"
 */

const KEYS = ['protocol', 'routes packets', 'encryption'];

describe('matchKeyWords (what the app pre-ticks)', () => {
	it('matches every key word the typed text contains, as ascending indexes', () => {
		const { result } = matchKeyWords('A protocol that routes packets between hosts', KEYS);
		expect(result).toEqual([0, 1]);
	});

	it('returns no indexes for empty typed text', () => {
		expect(matchKeyWords('', KEYS).result).toEqual([]);
		expect(matchKeyWords('   ', KEYS).result).toEqual([]);
	});

	it('returns no indexes when there are no key words', () => {
		expect(matchKeyWords('anything at all', []).result).toEqual([]);
	});

	it('ignores case and punctuation (normalised form)', () => {
		expect(matchKeyWords('PROTOCOL, which ROUTES   packets!', KEYS).result).toEqual([0, 1]);
	});

	it('matches whole words: a key word inside a longer word does not match', () => {
		expect(matchKeyWords('to concatenate strings', ['cat']).result).toEqual([]);
		expect(matchKeyWords('a cat sat', ['cat']).result).toEqual([0]);
	});

	it('matches a typo within allowedEdits of the key word length', () => {
		// "encryption" has 10 characters; a transposition is one edit, well within tolerance.
		expect(matchKeyWords('uses encrpytion for secrecy', KEYS).result).toEqual([2]);
	});

	it('allows no edits on a very short key word', () => {
		// "tcp" is at most 4 characters: zero edits allowed (FUZZY_EDITS).
		expect(matchKeyWords('uses tcq here', ['tcp']).result).toEqual([]);
		expect(matchKeyWords('uses tcp here', ['tcp']).result).toEqual([0]);
	});

	it('is deterministic and returns a trace array', () => {
		const a = matchKeyWords('protocol encryption', KEYS);
		const b = matchKeyWords('protocol encryption', KEYS);
		expect(b).toEqual(a);
		expect(Array.isArray(a.trace)).toBe(true);
	});

	it('property: indexes are unique, ascending and in range', () => {
		fc.assert(
			fc.property(
				fc.string(),
				fc.array(fc.string({ minLength: 1 }), { maxLength: 6 }),
				(typed, keys) => {
					const { result } = matchKeyWords(typed, keys);
					expect(result).toEqual([...new Set(result)].sort((x, y) => x - y));
					for (const i of result) {
						expect(i).toBeGreaterThanOrEqual(0);
						expect(i).toBeLessThan(keys.length);
					}
				}
			),
			{ numRuns: NUM_RUNS }
		);
	});
});

describe('gradeIdeaUnit', () => {
	const typed = 'A protocol that routes packets'; // pre-ticks 0 and 1

	it('is correct, with full weight, when every key word is ticked and all ticks are pre-ticks', () => {
		const { result } = gradeIdeaUnit({ typed, keyWords: KEYS.slice(0, 2), ticked: [0, 1] });
		expect(result.correct).toBe(true);
		expect(result.weight).toBe('full');
		expect(result.missing).toEqual([]);
		expect(result.preTicked).toEqual([0, 1]);
	});

	it('is incorrect when a key word is left unticked, and lists the missing ones ascending', () => {
		const { result } = gradeIdeaUnit({ typed, keyWords: KEYS, ticked: [0] });
		expect(result.correct).toBe(false);
		expect(result.missing).toEqual([1, 2]);
	});

	it('is incorrect when only the pre-ticks are kept but another key word exists', () => {
		const { result } = gradeIdeaUnit({ typed, keyWords: KEYS, ticked: [0, 1] });
		expect(result.correct).toBe(false);
		expect(result.missing).toEqual([2]);
	});

	it('counts as recognition when the student ticked a word the app did not pre-tick', () => {
		const { result } = gradeIdeaUnit({ typed, keyWords: KEYS, ticked: [0, 1, 2] });
		expect(result.correct).toBe(true);
		expect(result.weight).toBe('recognition');
		expect(result.preTicked).toEqual([0, 1]);
	});

	it('counts as recognition when nothing was typed and every key word was self-ticked', () => {
		const { result } = gradeIdeaUnit({ typed: '', keyWords: KEYS, ticked: [0, 1, 2] });
		expect(result.correct).toBe(true);
		expect(result.weight).toBe('recognition');
		expect(result.preTicked).toEqual([]);
	});

	it('ignores out-of-range and repeated ticks', () => {
		const { result } = gradeIdeaUnit({
			typed,
			keyWords: KEYS.slice(0, 2),
			ticked: [0, 0, 1, 1, 7, -1]
		});
		expect(result.correct).toBe(true);
		// The ignored ticks must not turn a pure-pre-tick answer into a recognition one.
		expect(result.weight).toBe('full');
	});

	it('does not accept ticks that are only out of range', () => {
		const { result } = gradeIdeaUnit({ typed, keyWords: ['protocol'], ticked: [5] });
		expect(result.correct).toBe(false);
		expect(result.missing).toEqual([0]);
	});

	it('throws for a note with no key words (the builder falls back to cloze)', () => {
		expect(() => gradeIdeaUnit({ typed, keyWords: [], ticked: [] })).toThrow();
	});

	it('is deterministic', () => {
		const input = { typed, keyWords: KEYS, ticked: [0, 1, 2] };
		expect(gradeIdeaUnit(input)).toEqual(gradeIdeaUnit(input));
	});

	it('agrees with matchKeyWords on preTicked', () => {
		const input = { typed, keyWords: KEYS, ticked: [0] };
		expect(gradeIdeaUnit(input).result.preTicked).toEqual(
			matchKeyWords(input.typed, input.keyWords).result
		);
	});
});
