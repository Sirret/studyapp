import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng, hashSeed, rngFor, shuffle } from '#lib/engine/rng.ts';
import { cardId, NUM_RUNS, SESSION } from './fixtures.ts';

const take = (rng: () => number, n: number) => Array.from({ length: n }, () => rng());

/** @see CLAUDE.md rule 2 and BUILD_PLAN Decisions log (RNG) */
describe('rng', () => {
	it('hashes to an unsigned 32-bit integer, the same every time', () => {
		fc.assert(
			fc.property(fc.array(fc.oneof(fc.string(), fc.integer())), (parts) => {
				const hash = hashSeed(...parts);
				expect(Number.isInteger(hash)).toBe(true);
				expect(hash).toBeGreaterThanOrEqual(0);
				expect(hash).toBeLessThan(2 ** 32);
				expect(hashSeed(...parts)).toBe(hash);
			}),
			{ numRuns: NUM_RUNS }
		);
	});

	it('matches the published FNV-1a vectors', () => {
		expect(hashSeed('')).toBe(0x811c9dc5);
		expect(hashSeed('a')).toBe(0xe40c292c);
		expect(hashSeed('foobar')).toBe(0xbf9cf968);
	});

	it('keeps parts apart, so ("ab", "c") and ("a", "bc") differ', () => {
		expect(hashSeed('ab', 'c')).not.toBe(hashSeed('a', 'bc'));
		expect(hashSeed('1', 2)).toBe(hashSeed(1, '2'));
	});

	it('returns numbers in [0, 1)', () => {
		fc.assert(
			fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), (seed) => {
				for (const value of take(createRng(seed), 50)) {
					expect(value).toBeGreaterThanOrEqual(0);
					expect(value).toBeLessThan(1);
				}
			}),
			{ numRuns: NUM_RUNS }
		);
	});

	it('repeats the same stream for the same card, session and attempt', () => {
		const a = take(rngFor(cardId(1), SESSION, 0), 20);
		expect(take(rngFor(cardId(1), SESSION, 0), 20)).toEqual(a);
		expect(take(rngFor(cardId(1), SESSION, 1), 20)).not.toEqual(a);
		expect(take(rngFor(cardId(2), SESSION, 0), 20)).not.toEqual(a);
	});

	it('spreads values roughly evenly', () => {
		const values = take(createRng(42), 10_000);
		const buckets = [0, 0, 0, 0];
		for (const value of values) buckets[Math.floor(value * 4)]! += 1;
		for (const count of buckets) expect(count).toBeGreaterThan(2300);
	});

	it('shuffles into a permutation without changing the input', () => {
		fc.assert(
			fc.property(fc.array(fc.integer()), fc.nat(), (items, seed) => {
				const before = [...items];
				const result = shuffle(items, createRng(seed));
				expect(items).toEqual(before);
				expect([...result].sort((a, b) => a - b)).toEqual([...items].sort((a, b) => a - b));
				expect(shuffle(items, createRng(seed))).toEqual(result);
			}),
			{ numRuns: NUM_RUNS }
		);
	});

	it('can put any item first', () => {
		const firsts = new Set<number>();
		for (let seed = 0; seed < 200; seed += 1)
			firsts.add(shuffle([0, 1, 2, 3], createRng(seed))[0]!);
		expect([...firsts].sort()).toEqual([0, 1, 2, 3]);
	});
});
