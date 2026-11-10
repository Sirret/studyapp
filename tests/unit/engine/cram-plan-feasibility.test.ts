import { describe, expect, it } from 'vitest';
import {
	CRITERION_FIRST,
	CRITERION_FIRST_DEGRADED,
	RELEARN_SESSIONS_MAX
} from '#lib/config/defaults.ts';
import { planCram, type CramCard, type CramPlan, type CramPlanInput } from '#lib/engine/cram.ts';
import { AT_RISK, cramCard, mixedDeck, planInput } from './cram-fixtures.ts';
import { cardId } from './fixtures.ts';

/**
 * planCram feasibility, the degrade order and determinism.
 *
 * @see BUILD_PLAN §6.6 "The plan (`planCram`), concretely" (feasibility and degrading) and
 *   Decisions log (Phase 7: cram plans)
 */

const plan = (input: CramPlanInput): CramPlan => planCram(input).result;

describe('planCram: feasibility and degrading', () => {
	const deck = mixedDeck();
	const perDay = (p: CramPlan, d: number) =>
		Array.from({ length: d }, (_, day) =>
			p.sessions
				.filter((s) => s.day === day && s.slot !== 'morning')
				.reduce((sum, s) => sum + s.minutes, 0)
		);

	it('is feasible with no degradations when time is generous', () => {
		const p = plan(planInput(4, deck));
		expect(p).toMatchObject({
			feasible: true,
			shortfallMinutes: 0,
			degradations: [],
			deferred: []
		});
		expect(p.criterion).toBe(CRITERION_FIRST);
		expect(p.relearnSessions).toBe(RELEARN_SESSIONS_MAX);
	});

	it('is feasible when every day exactly fits (≤, not <)', () => {
		const need = perDay(plan(planInput(4, deck)), 4);
		const p = plan(planInput(4, deck, { dayMinutes: need }));
		expect(p.feasible).toBe(true);
		expect(p.degradations).toStrictEqual([]);
	});

	it('degrades the criterion first, 3 → 2, when a day is just short', () => {
		const need = perDay(plan(planInput(4, deck)), 4).map((m) => m - 0.01);
		const p = plan(planInput(4, deck, { dayMinutes: need }));
		expect(p.degradations[0]).toBe('criterion');
		expect(p.criterion).toBe(CRITERION_FIRST_DEGRADED);
	});

	describe('when nothing can make it fit', () => {
		// Ten at-risk cards outweigh day 0 whatever is cut; the six minutes a day leave room for
		// one new card a day under the NEW_SHARE_MAX cap, so the new cards are scheduled at first.
		const atRisk = Array.from({ length: 10 }, (_, i) => cramCard(20 + i, { fsrs: AT_RISK }));
		const news: CramCard[] = [
			cramCard(1, { priority: 'high', noteType: 'keyterm' }),
			cramCard(2, { noteType: 'keyterm' }),
			cramCard(3, { noteType: 'cloze' }),
			cramCard(4, { noteType: 'keyterm' })
		];
		const input = planInput(5, [...atRisk, ...news], { dayMinutes: [6, 6, 6, 6, 6] });
		const p = plan(input);

		it('applies criterion, then relearning down to K = 1, then deferNew, each listed once', () => {
			expect(p.degradations).toStrictEqual(['criterion', 'relearning', 'deferNew']);
			expect(p.criterion).toBe(CRITERION_FIRST_DEGRADED);
			expect(p.relearnSessions).toBe(1);
		});

		it('defers new cards lowest value per minute first, ties by ID', () => {
			// cloze notes have the lowest p0, so the most intro minutes; high priority goes last.
			expect(p.deferred).toStrictEqual([cardId(3), cardId(2), cardId(4), cardId(1)]);
		});

		it('flags the plan infeasible with the shortfall summed over days', () => {
			expect(p.feasible).toBe(false);
			const excess = perDay(p, 5).reduce(
				(sum, m, d) => sum + Math.max(0, m - input.dayMinutes[d]!),
				0
			);
			expect(p.shortfallMinutes).toBeGreaterThan(0);
			expect(p.shortfallMinutes).toBeCloseTo(excess, 6);
		});

		it('keeps deferred cards out of every session', () => {
			for (const s of p.sessions) for (const id of p.deferred) expect(s.cardIds).not.toContain(id);
		});
	});
});

describe('planCram: determinism', () => {
	it('returns an identical plan and trace on a second call', () => {
		const input = planInput(5, mixedDeck(), { dayMinutes: [20, 15, 10, 30, 5] });
		expect(planCram(input)).toStrictEqual(planCram(input));
	});

	it('does not depend on the order the cards are given in', () => {
		const input = planInput(5, mixedDeck());
		const reversed = { ...input, cards: [...input.cards].reverse() };
		expect(plan(reversed)).toStrictEqual(plan(input));
	});
});
