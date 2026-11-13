import { describe, expect, it } from 'vitest';
import {
	ONENIGHT_BREAK_MIN,
	ONENIGHT_MIN_BLOCK_MIN,
	PRIORITY_WEIGHT
} from '#lib/config/defaults.ts';
import { planOneNight, type NightUnit } from '#lib/engine/onenight.ts';
import { cardId } from './fixtures.ts';

/** @see BUILD_PLAN §6.8 (incl. "Concretely"), CONCEPT §9 */

/** One minute per block-2 card. */
const SEC = 60;
const unit = (key: string, overrides: Partial<NightUnit> = {}): NightUnit => ({
	key,
	priority: 'normal',
	minutes: 10,
	ease: 0.5,
	cardIds: [],
	...overrides
});
const plan = (units: readonly NightUnit[], availableMinutes: number) =>
	planOneNight({ units, availableMinutes, blockTwoSecPerCard: SEC }).result;

describe('planOneNight: triage order', () => {
	it('puts the highest value per minute (PRIORITY_WEIGHT × cards / minutes) first', () => {
		const a = unit('a', { priority: 'high', minutes: 20, cardIds: [cardId(1)] });
		const b = unit('b', { minutes: 5, cardIds: [cardId(2)] });
		expect(PRIORITY_WEIGHT.normal / 5).toBeGreaterThan(PRIORITY_WEIGHT.high / 20);
		expect(plan([a, b], 1_000).chosen).toStrictEqual(['b', 'a']);
	});

	it('breaks value ties easier first (higher ease)', () => {
		const hard = unit('a', { ease: 0.3, cardIds: [cardId(1)] });
		const easy = unit('b', { ease: 0.5, cardIds: [cardId(2)] });
		expect(plan([hard, easy], 1_000).chosen).toStrictEqual(['b', 'a']);
	});

	it('breaks full ties by key', () => {
		const units = [
			unit('c', { cardIds: [cardId(3)] }),
			unit('a', { cardIds: [cardId(1)] }),
			unit('b', { cardIds: [cardId(2)] })
		];
		expect(plan(units, 1_000).chosen).toStrictEqual(['a', 'b', 'c']);
	});

	it('cuts the hardest-from-cold unit first when only one of two equal-value units fits', () => {
		const hard = unit('a', { ease: 0.3, cardIds: [cardId(1)] });
		const easy = unit('b', { ease: 0.5, cardIds: [cardId(2)] });
		const p = plan([hard, easy], 10 + ONENIGHT_BREAK_MIN + 1);
		expect(p.chosen).toStrictEqual(['b']);
		expect(p.skipped).toStrictEqual(['a']);
	});
});

describe('planOneNight: greedy fit', () => {
	const x = unit('x', { priority: 'high', minutes: 10, cardIds: [cardId(1)] });
	const y = unit('y', { priority: 'high', minutes: 30, cardIds: [cardId(2)] });
	const z = unit('z', { minutes: 12, cardIds: [cardId(3)] });

	it('chooses a unit when block 1 + its minutes + the break + block 2 still fit', () => {
		const p = plan([x, y, z], 1_000);
		expect(p.chosen).toStrictEqual(['x', 'y', 'z']);
		expect(p.skipped).toStrictEqual([]);
		expect(p.complete).toBe(true);
	});

	it('skips a unit that does not fit and tries the next one', () => {
		const p = plan([x, y, z], 40);
		expect(p.chosen).toStrictEqual(['x', 'z']);
		expect(p.skipped).toStrictEqual(['y']);
		expect(p.complete).toBe(false);
	});

	it('chooses a unit that fits exactly (≤)', () => {
		const exact = 10 + 12 + ONENIGHT_BREAK_MIN + 2;
		expect(plan([x, z], exact).chosen).toStrictEqual(['x', 'z']);
		expect(plan([x, z], exact - 0.01).chosen).toStrictEqual(['x']);
	});

	it('counts block 2 at blockTwoSecPerCard per chosen card', () => {
		const one = unit('a', { minutes: 5, cardIds: [cardId(7)] });
		const many = unit('m', { minutes: 10, cardIds: [1, 2, 3, 4, 5, 6].map(cardId) });
		const fits = 5 + 10 + ONENIGHT_BREAK_MIN + 7;
		const at = (sec: number) =>
			planOneNight({ units: [one, many], availableMinutes: fits, blockTwoSecPerCard: sec }).result;
		// m first: 6 cards in 10 min is worth more per minute than 1 card in 5.
		expect(at(SEC).chosen).toStrictEqual(['m', 'a']);
		expect(at(2 * SEC).chosen).toStrictEqual(['m']);
		expect(at(2 * SEC).minimumBlock).toBe(false);
	});

	it('plans block 1 + break + block 2 minutes', () => {
		const p = plan([x, y, z], 40);
		expect(p.minutes).toBeCloseTo(10 + 12 + ONENIGHT_BREAK_MIN + 2, 9);
		expect(p.breakMinutes).toBe(ONENIGHT_BREAK_MIN);
	});

	it('is not a minimum block when the time it was given holds a unit', () => {
		expect(plan([x, y, z], 40).minimumBlock).toBe(false);
	});

	it('is complete with no units', () => {
		// SPEC-GAP: "every unit fitted" read as vacuously true with no units.
		const p = plan([], 60);
		expect(p).toMatchObject({ chosen: [], skipped: [], block2: [], morning: [], complete: true });
	});
});

describe('planOneNight: block 2 and the morning check', () => {
	const u1 = unit('u1', {
		priority: 'high',
		minutes: 5,
		cardIds: [cardId(1), cardId(2), cardId(3)]
	});
	const u2 = unit('u2', { minutes: 5, cardIds: [cardId(4)] });
	const u3 = unit('u3', { minutes: 5, ease: 0.4, cardIds: [cardId(5), cardId(6)] });

	it('re-quizzes every chosen card, round-robin across chosen units in triage order', () => {
		// Same minutes, so value per minute follows the card count (valueOf): u1, u3, u2.
		const p = plan([u3, u2, u1], 1_000);
		expect(p.chosen).toStrictEqual(['u1', 'u3', 'u2']);
		expect(p.block2).toStrictEqual([1, 5, 4, 2, 6, 3].map(cardId));
	});

	it('leaves skipped units out of block 2', () => {
		const p = plan([u1, u2, u3], 5 + 5 + ONENIGHT_BREAK_MIN + 4);
		expect(p.skipped).toStrictEqual(['u3']);
		expect(p.block2).toStrictEqual([1, 4, 2, 3].map(cardId));
	});

	it('checks the same cards in the same order on exam morning', () => {
		const p = plan([u1, u2, u3], 1_000);
		expect(p.morning).toStrictEqual(p.block2);
	});

	it('is deterministic, trace included', () => {
		const input = { units: [u1, u2, u3], availableMinutes: 30, blockTwoSecPerCard: SEC };
		expect(planOneNight(input)).toStrictEqual(planOneNight(input));
	});
});

describe('planOneNight: minimum block (SESSION_NOTES A1)', () => {
	const x = unit('x', { priority: 'high', minutes: 10, cardIds: [cardId(1)] });
	const z = unit('z', { minutes: 12, cardIds: [cardId(3)] });
	const big = unit('big', { minutes: ONENIGHT_MIN_BLOCK_MIN + 30, cardIds: [cardId(9)] });

	it('plans an ONENIGHT_MIN_BLOCK_MIN block when no unit fits the time left (past sleep start)', () => {
		const p = plan([z, x], 0);
		expect(p.minimumBlock).toBe(true);
		expect(p.chosen).toStrictEqual(['x', 'z']);
		expect(p.minutes).toBeLessThanOrEqual(ONENIGHT_MIN_BLOCK_MIN);
		expect(p.block2).toStrictEqual([cardId(1), cardId(3)]);
	});

	it('fills the minimum block greedily in triage order', () => {
		const y = unit('y', { priority: 'high', minutes: 30, cardIds: [cardId(2)] });
		const p = plan([x, y, z], 5);
		// x (10) + y (30) + break + 2 cards > 45; x + z + break + 2 cards = 34 fits.
		expect(p.chosen).toStrictEqual(['x', 'z']);
		expect(p.skipped).toStrictEqual(['y']);
		expect(p.complete).toBe(false);
	});

	it('still plans the first unit in triage order when none fits even the minimum block', () => {
		const p = plan([big], 0);
		expect(p.minimumBlock).toBe(true);
		expect(p.chosen).toStrictEqual(['big']);
		expect(p.minutes).toBeGreaterThan(ONENIGHT_MIN_BLOCK_MIN);
	});

	it('is not a minimum block with no units', () => {
		expect(plan([], 0)).toMatchObject({ chosen: [], minimumBlock: false, minutes: 0 });
	});

	it('traces the minimum block', () => {
		const { trace } = planOneNight({ units: [x], availableMinutes: 0, blockTwoSecPerCard: SEC });
		expect(trace).toContainEqual(expect.objectContaining({ rule: 'onenight.minimumBlock' }));
	});
});
