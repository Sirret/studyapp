import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
	gradeEdgeSet,
	gradeSequence,
	hitTest,
	type EdgeTriple,
	type FractionBox
} from '#lib/engine/grading-shapes.ts';
import { NUM_RUNS } from './fixtures.ts';

/** Asserts `fn` throws for a spec reason, not because it is still a stub. */
function expectSpecThrow(fn: () => unknown): void {
	let error: unknown;
	try {
		fn();
	} catch (e) {
		error = e;
	}
	expect(error).toBeInstanceOf(Error);
	expect((error as Error).message).not.toBe('not implemented');
}

/** @see BUILD_PLAN §6.10 (hit test) */
describe('hitTest', () => {
	// At 400×200 this box spans x 100–300, y 50–150.
	const box: FractionBox = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
	const size = { width: 400, height: 200 };

	it('is true for a point inside the box', () => {
		expect(hitTest({ x: 200, y: 100 }, box, size)).toBe(true);
	});

	it('is false for points outside the box on each side', () => {
		expect(hitTest({ x: 99, y: 100 }, box, size)).toBe(false);
		expect(hitTest({ x: 301, y: 100 }, box, size)).toBe(false);
		expect(hitTest({ x: 200, y: 49 }, box, size)).toBe(false);
		expect(hitTest({ x: 200, y: 151 }, box, size)).toBe(false);
	});

	it('includes points exactly on the edges and corners', () => {
		expect(hitTest({ x: 100, y: 100 }, box, size)).toBe(true);
		expect(hitTest({ x: 300, y: 100 }, box, size)).toBe(true);
		expect(hitTest({ x: 200, y: 50 }, box, size)).toBe(true);
		expect(hitTest({ x: 200, y: 150 }, box, size)).toBe(true);
		expect(hitTest({ x: 100, y: 50 }, box, size)).toBe(true);
		expect(hitTest({ x: 300, y: 150 }, box, size)).toBe(true);
	});

	it('scales the fractions by the rendered size', () => {
		// At 200×400 the same box spans x 50–150, y 100–300.
		const tall = { width: 200, height: 400 };
		expect(hitTest({ x: 200, y: 60 }, box, size)).toBe(true);
		expect(hitTest({ x: 200, y: 60 }, box, tall)).toBe(false);
		expect(hitTest({ x: 60, y: 200 }, box, tall)).toBe(true);
		expect(hitTest({ x: 60, y: 200 }, box, size)).toBe(false);
	});
});

/** @see BUILD_PLAN §6.10 (sequences) and Decisions log (LIS ties) */
describe('gradeSequence', () => {
	const verdict = (order: number[]) => gradeSequence(order).result;

	it('is correct with nothing misplaced only when the order is exact', () => {
		expect(verdict([0, 1, 2, 3])).toEqual({ correct: true, misplaced: [] });
		expect(verdict([0])).toEqual({ correct: true, misplaced: [] });
	});

	it('marks the steps outside the longest increasing subsequence as misplaced', () => {
		expect(verdict([3, 0, 1, 2])).toEqual({ correct: false, misplaced: [3] });
		expect(verdict([0, 3, 1, 2, 4])).toEqual({ correct: false, misplaced: [3] });
	});

	it('reports misplaced step indexes in ascending order', () => {
		expect(verdict([4, 3, 0, 1, 2])).toEqual({ correct: false, misplaced: [3, 4] });
	});

	it('breaks LIS ties by keeping the earliest positions', () => {
		// [1, 0, 2, 3]: {1,2,3} (positions 0,2,3) and {0,2,3} (positions 1,2,3) tie → keep step 1.
		expect(verdict([1, 0, 2, 3])).toEqual({ correct: false, misplaced: [0] });
		expect(verdict([1, 0])).toEqual({ correct: false, misplaced: [0] });
		// [2, 3, 0, 1]: {2,3} at positions 0,1 beats {0,1} at positions 2,3.
		expect(verdict([2, 3, 0, 1])).toEqual({ correct: false, misplaced: [0, 1] });
	});

	it('throws when the order is not a permutation of 0…n−1', () => {
		expectSpecThrow(() => gradeSequence([0, 0]));
		expectSpecThrow(() => gradeSequence([1, 2]));
		expectSpecThrow(() => gradeSequence([0, 2]));
		expectSpecThrow(() => gradeSequence([-1, 0]));
		expectSpecThrow(() => gradeSequence([0, 1.5]));
	});

	it('keeps an increasing run and misplaces exactly n − LIS steps (property)', () => {
		const permutation = fc.integer({ min: 1, max: 8 }).chain((n) =>
			fc.shuffledSubarray(
				Array.from({ length: n }, (_, i) => i),
				{ minLength: n, maxLength: n }
			)
		);
		fc.assert(
			fc.property(permutation, (order) => {
				const { correct, misplaced } = verdict(order);
				const identity = order.every((step, i) => step === i);
				expect(correct).toBe(identity);
				expect(misplaced).toEqual([...misplaced].sort((a, b) => a - b));
				const kept = order.filter((step) => !misplaced.includes(step));
				kept.slice(1).forEach((step, i) => expect(step).toBeGreaterThan(kept[i] ?? -1));
				expect(kept.length).toBe(lisLength(order));
			}),
			{ numRuns: NUM_RUNS }
		);
	});

	it('is deterministic: identical result and trace', () => {
		expect(gradeSequence([2, 0, 3, 1])).toEqual(gradeSequence([2, 0, 3, 1]));
	});
});

/** Reference LIS length, O(n²). */
function lisLength(xs: readonly number[]): number {
	const best: number[] = [];
	xs.forEach((x, i) => {
		const before = xs.slice(0, i).map((y, j) => (y < x ? (best[j] ?? 0) : 0));
		best.push(1 + Math.max(0, ...before));
	});
	return Math.max(0, ...best);
}

/** @see BUILD_PLAN §6.10 (diagram rebuild) and Decisions log (edge sets) */
describe('gradeEdgeSet', () => {
	const key = (e: EdgeTriple) => `${e.from}|${e.to}|${e.label ?? ''}`;
	const keys = (edges: EdgeTriple[]) => edges.map(key);
	const verdict = (student: EdgeTriple[], reference: EdgeTriple[]) =>
		gradeEdgeSet(student, reference).result;

	const ab: EdgeTriple = { from: 'a', to: 'b', label: 'uses' };
	const bc: EdgeTriple = { from: 'b', to: 'c' };
	const reference: EdgeTriple[] = [ab, bc];

	it('is correct when the sets are equal, in any order', () => {
		const result = verdict([bc, ab], reference);
		expect(result).toEqual({ correct: true, missing: [], extra: [] });
	});

	it('lists missing and extra edges', () => {
		const result = verdict([ab, { from: 'c', to: 'd' }], reference);
		expect(result.correct).toBe(false);
		expect(keys(result.missing)).toEqual(['b|c|']);
		expect(keys(result.extra)).toEqual(['c|d|']);
	});

	it('treats edges as directed', () => {
		const result = verdict([{ from: 'b', to: 'a', label: 'uses' }, bc], reference);
		expect(result.correct).toBe(false);
		expect(keys(result.missing)).toEqual(['a|b|uses']);
		expect(keys(result.extra)).toEqual(['b|a|uses']);
	});

	it('compares labels after normalising', () => {
		const result = verdict([{ from: 'a', to: 'b', label: '  USES. ' }, bc], reference);
		expect(result).toEqual({ correct: true, missing: [], extra: [] });
	});

	it('treats a different label as a different edge', () => {
		const result = verdict([{ from: 'a', to: 'b', label: 'calls' }, bc], reference);
		expect(result.correct).toBe(false);
		expect(result.missing.map((e) => e.from + e.to)).toEqual(['ab']);
		expect(result.extra.map((e) => e.from + e.to)).toEqual(['ab']);
	});

	it('treats a missing label as equal to an empty one', () => {
		const result = verdict([ab, { from: 'b', to: 'c', label: '' }], reference);
		expect(result).toEqual({ correct: true, missing: [], extra: [] });
		expect(verdict([{ from: 'x', to: 'y', label: ' ' }], [{ from: 'x', to: 'y' }]).correct).toBe(
			true
		);
	});

	it('collapses duplicate edges', () => {
		const student = [ab, bc, { from: 'a', to: 'b', label: 'Uses' }];
		expect(verdict(student, reference)).toEqual({ correct: true, missing: [], extra: [] });
		expect(verdict(reference, [...reference, bc]).correct).toBe(true);
		const extra = verdict(
			[...reference, { from: 'd', to: 'e' }, { from: 'd', to: 'e' }],
			reference
		);
		expect(keys(extra.extra)).toEqual(['d|e|']);
	});

	it('sorts missing and extra by from, then to, then normalised label', () => {
		const ref: EdgeTriple[] = [
			{ from: 'b', to: 'a' },
			{ from: 'a', to: 'c', label: 'z' },
			{ from: 'a', to: 'c', label: 'm' },
			{ from: 'a', to: 'b' }
		];
		expect(keys(verdict([], ref).missing)).toEqual(['a|b|', 'a|c|m', 'a|c|z', 'b|a|']);
		expect(keys(verdict(ref, []).extra)).toEqual(['a|b|', 'a|c|m', 'a|c|z', 'b|a|']);
	});

	it('is correct for two empty sets', () => {
		expect(verdict([], [])).toEqual({ correct: true, missing: [], extra: [] });
	});

	it('is deterministic: identical result and trace', () => {
		const student = [{ from: 'c', to: 'd' }, ab];
		expect(gradeEdgeSet(student, reference)).toEqual(gradeEdgeSet(student, reference));
	});
});
