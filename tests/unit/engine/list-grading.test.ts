import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LIST_ALL_ONLY_MAX, LIST_N_MIN, LIST_N_SHARE } from '#lib/config/defaults.ts';
import {
	gradeListPicked,
	gradeListTyped,
	listPath,
	listRequired
} from '#lib/engine/list-grading.ts';
import { cardId, NUM_RUNS } from './fixtures.ts';

/**
 * List cards: "name N of M" grading, the list path and picked-option grading.
 *
 * @see BUILD_PLAN §5.1 row listN; SESSION_NOTES D4, J; Decisions log "Phase 8.6 Q9"
 */

const ITEMS = ['virus', 'worm', 'trojan', 'ransomware', 'spyware', 'adware'];
const typedGrade = (typed: string[], required: number, items: readonly string[] = ITEMS) =>
	gradeListTyped({ cardId: cardId(1), items, typed, required }).result;

describe('listRequired (N for "name N of M")', () => {
	it.each([
		[2, 2],
		[3, 2],
		[4, 2],
		[5, 3],
		[6, 3],
		[8, 4],
		[9, 5]
	])('is %i items -> N = %i', (m, n) => {
		expect(listRequired(m)).toBe(n);
	});

	it('is never above the item count, even when the minimum is bigger', () => {
		expect(listRequired(1)).toBe(1);
	});

	it('property: ceil(M x share), at least the minimum, at most M', () => {
		fc.assert(
			fc.property(fc.integer({ min: 1, max: 60 }), (m) => {
				const n = listRequired(m);
				expect(n).toBe(Math.min(m, Math.max(LIST_N_MIN, Math.ceil(m * LIST_N_SHARE))));
			}),
			{ numRuns: NUM_RUNS }
		);
	});
});

describe('listPath', () => {
	it('is listAll alone for a list of at most LIST_ALL_ONLY_MAX items', () => {
		for (let m = 1; m <= LIST_ALL_ONLY_MAX; m += 1) expect(listPath(m)).toEqual(['listAll']);
	});

	it('is recognition first, then recall, from LIST_ALL_ONLY_MAX + 1 items', () => {
		expect(listPath(LIST_ALL_ONLY_MAX + 1)).toEqual(['listPick', 'listNot', 'listN', 'listAll']);
		expect(listPath(12)).toEqual(['listPick', 'listNot', 'listN', 'listAll']);
	});

	it('never contains a self-rated kind (no reverse or flip card for a list)', () => {
		for (const kind of listPath(8)) expect(['flip', 'explainIt', 'blurt']).not.toContain(kind);
	});
});

describe('gradeListTyped', () => {
	it('is correct when valid entries reach the required count', () => {
		const grade = typedGrade(['virus', 'worm', 'trojan'], 3);
		expect(grade.correct).toBe(true);
		expect(grade.valid).toEqual([0, 1, 2]);
		expect(grade.wrong).toEqual([]);
		expect(grade.required).toBe(3);
	});

	it('is incorrect one short of the required count', () => {
		const grade = typedGrade(['virus', 'worm'], 3);
		expect(grade.correct).toBe(false);
		expect(grade.valid).toEqual([0, 1]);
	});

	it('accepts items in any order and any item of the list (N of M)', () => {
		const grade = typedGrade(['adware', 'virus', 'spyware'], 3);
		expect(grade.correct).toBe(true);
		expect(grade.valid).toEqual([0, 4, 5]);
	});

	it('names the full list when required equals M', () => {
		expect(typedGrade([...ITEMS].reverse(), ITEMS.length).correct).toBe(true);
		expect(typedGrade(ITEMS.slice(1), ITEMS.length).correct).toBe(false);
	});

	it('ignores case and surrounding punctuation or spaces', () => {
		const grade = typedGrade(['  VIRUS. ', 'Worm'], 2);
		expect(grade.valid).toEqual([0, 1]);
	});

	it('forgives a typo (fuzzy) on a long enough item', () => {
		expect(typedGrade(['ransomwar', 'trojan'], 2).valid).toEqual([2, 3]);
	});

	it('counts an item named twice once', () => {
		const grade = typedGrade(['virus', 'VIRUS', 'worm'], 3);
		expect(grade.valid).toEqual([0, 1]);
		expect(grade.correct).toBe(false);
		// SPEC-GAP: is a repeated entry `wrong`? Reading: no, it is neither valid nor wrong.
		expect(grade.wrong).toEqual([]);
	});

	it('marks entries that match no item as wrong, by entry index', () => {
		const grade = typedGrade(['virus', 'banana', 'worm', 'laptop'], 2);
		expect(grade.valid).toEqual([0, 1]);
		expect(grade.wrong).toEqual([1, 3]);
	});

	it('does not let wrong entries make a sufficient answer incorrect', () => {
		const grade = typedGrade(['virus', 'banana', 'worm'], 2);
		expect(grade.correct).toBe(true);
		expect(grade.wrong).toEqual([1]);
	});

	it('skips empty entries without marking them wrong', () => {
		const grade = typedGrade(['virus', '', '   ', 'worm'], 2);
		expect(grade.valid).toEqual([0, 1]);
		expect(grade.wrong).toEqual([]);
	});

	it('is incorrect with no entries', () => {
		const grade = typedGrade([], 2);
		expect(grade.correct).toBe(false);
		expect(grade.valid).toEqual([]);
	});

	it('guards collisions: an exact entry matches its own item, not a near neighbour', () => {
		const grade = typedGrade(['stick'], 1, ['stack', 'stick']);
		expect(grade.valid).toEqual([1]);
	});

	it('is deterministic and returns a trace array', () => {
		const input = { cardId: cardId(1), items: ITEMS, typed: ['virus', 'x'], required: 2 };
		const a = gradeListTyped(input);
		expect(gradeListTyped(input)).toEqual(a);
		expect(Array.isArray(a.trace)).toBe(true);
	});

	it('property: valid and wrong are ascending and unique; correct iff valid >= required', () => {
		fc.assert(
			fc.property(
				fc.array(fc.constantFrom(...ITEMS, 'banana', '', 'laptop'), { maxLength: 9 }),
				fc.integer({ min: 1, max: ITEMS.length }),
				(typed, required) => {
					const grade = typedGrade(typed, required);
					expect(grade.valid).toEqual([...new Set(grade.valid)].sort((x, y) => x - y));
					expect(grade.wrong).toEqual([...new Set(grade.wrong)].sort((x, y) => x - y));
					expect(grade.correct).toBe(grade.valid.length >= required);
				}
			),
			{ numRuns: NUM_RUNS }
		);
	});
});

describe('gradeListPicked', () => {
	const pick = (picked: number[], required: number, correct = [0, 2, 3, 5]) =>
		gradeListPicked({ correct, picked, required }).result;

	it('is correct when no pick is wrong and at least `required` correct options are picked', () => {
		const grade = pick([0, 2, 3], 3);
		expect(grade.correct).toBe(true);
		expect(grade.valid).toEqual([0, 2, 3]);
		expect(grade.wrong).toEqual([]);
		expect(grade.required).toBe(3);
	});

	it('is correct when more than `required` correct options are picked', () => {
		expect(pick([0, 2, 3, 5], 2).correct).toBe(true);
	});

	it('is incorrect when too few correct options are picked', () => {
		expect(pick([0, 2], 3).correct).toBe(false);
	});

	it('is incorrect when any pick is wrong, even with enough correct ones', () => {
		const grade = pick([0, 1, 2, 3], 3);
		expect(grade.correct).toBe(false);
		expect(grade.wrong).toEqual([1]);
		expect(grade.valid).toEqual([0, 2, 3]);
	});

	it('is incorrect with no picks', () => {
		const grade = pick([], 2);
		expect(grade.correct).toBe(false);
		expect(grade.valid).toEqual([]);
	});

	it('select-all (required = M) needs every correct option', () => {
		expect(pick([0, 2, 3], 4).correct).toBe(false);
		expect(pick([5, 3, 2, 0], 4).correct).toBe(true);
	});

	it('returns valid and wrong ascending whatever the pick order', () => {
		const grade = pick([5, 4, 0, 1], 2);
		expect(grade.valid).toEqual([0, 5]);
		expect(grade.wrong).toEqual([1, 4]);
	});

	it('counts a repeated pick once', () => {
		// SPEC-GAP: repeated pick indexes. Reading: each option counts once.
		const grade = pick([0, 0, 2], 3);
		expect(grade.valid).toEqual([0, 2]);
		expect(grade.correct).toBe(false);
	});

	it('is deterministic and returns a trace array', () => {
		const input = { correct: [0, 1], picked: [0], required: 1 };
		const a = gradeListPicked(input);
		expect(gradeListPicked(input)).toEqual(a);
		expect(Array.isArray(a.trace)).toBe(true);
	});
});
