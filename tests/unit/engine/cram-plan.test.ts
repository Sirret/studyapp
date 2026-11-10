import { describe, expect, it } from 'vitest';
import { CRITERION_FIRST, P0, RELEARN_SESSIONS_MAX } from '#lib/config/defaults.ts';
import type { CardId, ExamFormat } from '#lib/db/schemas/common.ts';
import {
	cramOrder,
	nextGap,
	planCram,
	triage,
	type CramPlan,
	type CramPlanInput
} from '#lib/engine/cram.ts';
import { withMargin } from '#lib/engine/estimate.ts';
import { retrievabilityAt } from '#lib/engine/fsrs.ts';
import {
	AT_RISK,
	AT_RISK_LONG,
	cramCard,
	mixedDeck,
	NOW,
	planInput,
	SECURE
} from './cram-fixtures.ts';
import { cardId } from './fixtures.ts';

/** @see BUILD_PLAN §6.6 "The plan (`planCram`), concretely" and Decisions log (Phase 7: cram plans) */

const plan = (input: CramPlanInput): CramPlan => planCram(input).result;
const slots = (p: CramPlan) => p.sessions.map((s) => `${s.day}:${s.slot}`);
/** Days of the non-final sessions (evenings) a card is in. */
const eveningsOf = (p: CramPlan, id: CardId) =>
	p.sessions.filter((s) => s.slot === 'evening' && s.cardIds.includes(id)).map((s) => s.day);
const finalPass = (p: CramPlan) => p.sessions.find((s) => s.slot === 'finalPass');

/** The repeat days the spec describes for one card, from its first session day. */
function repeatDays(
	d: number,
	first: number,
	format: ExamFormat,
	interval: number | null,
	weak: boolean,
	k: number
) {
	const days: number[] = [];
	for (let day = first; day < d - 1 && days.length < k;) {
		days.push(day);
		day += nextGap({
			daysRemaining: d - day,
			examFormat: format,
			fsrsIntervalDays: interval,
			weak
		});
	}
	return days;
}

describe('planCram: session shapes', () => {
	it('plans only the morning top-up at D = 0', () => {
		const p = plan(planInput(0, mixedDeck(), { dayMinutes: [] }));
		expect(slots(p)).toStrictEqual(['0:morning']);
		expect(p.sessions[0]!.newCardIds).toStrictEqual([]);
		// SPEC-GAP: with no days before the exam, read "feasible" as vacuously true.
		expect(p.feasible).toBe(true);
		expect(p.shortfallMinutes).toBe(0);
	});

	it('plans a final pass on day 0 and the morning on day 1 at D = 1, new cards in the final pass', () => {
		const deck = mixedDeck();
		const p = plan(planInput(1, deck));
		expect(slots(p)).toStrictEqual(['0:finalPass', '1:morning']);
		const news = deck.filter((c) => c.fsrs === null).map((c) => c.id);
		expect([...p.sessions[0]!.newCardIds].sort()).toStrictEqual([...news].sort());
	});

	it('plans evening, final pass and morning at D = 2', () => {
		const p = plan(planInput(2, mixedDeck()));
		expect(slots(p)).toStrictEqual(['0:evening', '1:finalPass', '2:morning']);
	});

	it('puts at-risk and new cards in the D = 2 evening, secure ones not', () => {
		const deck = mixedDeck();
		const evening = plan(planInput(2, deck)).sessions[0]!;
		for (const c of deck) {
			if (c.fsrs === SECURE) expect(evening.cardIds).not.toContain(c.id);
			else expect(evening.cardIds).toContain(c.id);
		}
	});

	it('plans an evening on each day 0..D−2, a final pass on D−1 and the morning on D', () => {
		const p = plan(planInput(5, mixedDeck()));
		expect(slots(p)).toStrictEqual([
			'0:evening',
			'1:evening',
			'2:evening',
			'3:evening',
			'4:finalPass',
			'5:morning'
		]);
	});

	it('puts every in-scope card in the final pass', () => {
		for (const d of [1, 2, 4, 7]) {
			const deck = mixedDeck();
			const p = plan(planInput(d, deck));
			const pass = finalPass(p)!;
			for (const c of deck) if (!p.deferred.includes(c.id)) expect(pass.cardIds).toContain(c.id);
		}
	});
});

describe('planCram: new cards', () => {
	const news = [
		cramCard(1),
		cramCard(2),
		cramCard(3, { priority: 'high' }),
		cramCard(4, { priority: 'high' })
	];

	it('introduces high-priority cards first, then by ID, newPerDay per day on days 0..D−2', () => {
		const p = plan(planInput(3, news));
		expect([...p.sessions[0]!.newCardIds].sort()).toStrictEqual([cardId(3), cardId(4)]);
		expect([...p.sessions[1]!.newCardIds].sort()).toStrictEqual([cardId(1), cardId(2)]);
	});

	it('introduces none after day D−2 and none on exam day', () => {
		const p = plan(planInput(6, [...news, cramCard(5), cramCard(6)]));
		for (const s of p.sessions) if (s.day >= 6 - 1) expect(s.newCardIds).toStrictEqual([]);
	});

	it('introduces each new card once, inside the session that holds it, and never before', () => {
		const p = plan(planInput(4, news));
		const introDay = new Map<CardId, number>();
		for (const s of p.sessions) {
			for (const id of s.newCardIds) {
				expect(introDay.has(id)).toBe(false);
				expect(s.cardIds).toContain(id);
				introDay.set(id, s.day);
			}
		}
		for (const s of p.sessions) {
			for (const id of s.cardIds)
				if (introDay.has(id)) expect(s.day).toBeGreaterThanOrEqual(introDay.get(id)!);
		}
	});

	it('brings a new card back by nextGap after its intro (no FSRS interval yet)', () => {
		const p = plan(planInput(5, [cramCard(1)]));
		expect(eveningsOf(p, cardId(1))).toStrictEqual(
			repeatDays(5, 0, 'recall', null, false, RELEARN_SESSIONS_MAX)
		);
	});
});

describe('planCram: repeats', () => {
	it('starts every at-risk card on day 0', () => {
		for (const d of [1, 3, 7]) {
			const p = plan(planInput(d, mixedDeck()));
			for (const c of mixedDeck()) {
				if (c.fsrs === AT_RISK || c.fsrs === AT_RISK_LONG)
					expect(p.sessions[0]!.cardIds).toContain(c.id);
			}
		}
	});

	it('brings an at-risk card back by nextGap with its FSRS interval', () => {
		// The interval is longer than any cram gap here, so it never binds.
		expect(AT_RISK_LONG.scheduled_days).toBeGreaterThanOrEqual(7);
		for (const format of ['recognition', 'mixed', 'recall'] as const) {
			const p = plan(planInput(7, [cramCard(1, { fsrs: AT_RISK_LONG })], { examFormat: format }));
			expect(eveningsOf(p, cardId(1))).toStrictEqual(
				repeatDays(7, 0, format, null, false, RELEARN_SESSIONS_MAX)
			);
		}
	});

	it('brings a weak card back every day, at most K sessions before the final pass', () => {
		const p = plan(planInput(5, [cramCard(1, { fsrs: AT_RISK, weak: true })]));
		expect(eveningsOf(p, cardId(1))).toStrictEqual([0, 1, 2].slice(0, RELEARN_SESSIONS_MAX));
		expect(finalPass(p)!.cardIds).toContain(cardId(1));
	});

	it('shows secure cards only in the final pass', () => {
		const p = plan(planInput(6, mixedDeck()));
		for (const id of [cardId(4), cardId(5)]) expect(eveningsOf(p, id)).toStrictEqual([]);
		expect(finalPass(p)!.cardIds).toEqual(expect.arrayContaining([cardId(4), cardId(5)]));
	});

	it('orders each session by cramOrder', () => {
		const deck = mixedDeck();
		const input = planInput(4, deck);
		for (const s of plan(input).sessions) {
			const inSession = deck.filter((c) => s.cardIds.includes(c.id));
			expect(s.cardIds).toStrictEqual(cramOrder(inSession, input.examAt, input.fsrs).result);
		}
	});

	it('records each card standing from triage', () => {
		const input = planInput(3, mixedDeck());
		const p = plan(input);
		for (const c of input.cards)
			expect(p.standing[c.id]).toBe(triage(c, input.examAt, input.fsrs).result);
	});
});

describe('planCram: minutes', () => {
	it('costs an at-risk card 1 / R(now) attempts in a session, with the safety margin', () => {
		const input = planInput(1, [cramCard(1, { fsrs: AT_RISK })]);
		const r = retrievabilityAt(AT_RISK, NOW, input.fsrs);
		expect(r).toBeGreaterThan(P0.concept);
		expect(plan(input).sessions[0]!.minutes).toBeCloseTo(withMargin(1 / r), 6);
	});

	it('costs a new card k / p0 attempts in its intro session', () => {
		const p = plan(planInput(1, [cramCard(1)]));
		expect(p.criterion).toBe(CRITERION_FIRST);
		expect(p.sessions[0]!.minutes).toBeCloseTo(withMargin(CRITERION_FIRST / P0.concept), 6);
	});

	it('costs a new card 1 / p0 attempts in its later sessions', () => {
		const p = plan(planInput(2, [cramCard(1)]));
		expect(finalPass(p)!.minutes).toBeCloseTo(withMargin(1 / P0.concept), 6);
	});
});
