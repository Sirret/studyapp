import { describe, expect, it } from 'vitest';
import {
	LEARN_ROUND_CARDS,
	ROUND_MAX_ANSWERS,
	ROUND_MAX_MINUTES,
	ROUND_WORKING_SET
} from '#lib/config/defaults.ts';
import type { SessionSnapshot } from '#lib/db/schemas/session.ts';
import { SessionSnapshotSchema } from '#lib/db/schemas/session.ts';
import { checkRoundEnd, roundSummary, startRound } from '#lib/engine/round.ts';
import { planSession } from '#lib/engine/session.ts';
import { cardId } from './fixtures.ts';
import { cardRange, makeSnapshot, MINUTE, planCard, T0 } from './session-fixtures.ts';

const HOURS_MS = 5 * 60 * MINUTE;
const ROUND_MS = ROUND_MAX_MINUTES * MINUTE;
const done = { done: true, count: 1, lastFull: true };
const CONTINUE = { afterBreak: false };
const end = (state: SessionSnapshot, now = T0) => checkRoundEnd(state, now).result;
const ids = (...n: number[]) => n.map((i) => cardId(i));

/** A count round over cards 1..LEARN_ROUND_CARDS, all unfinished. */
const countRound = (round = {}, rest: Partial<SessionSnapshot> = {}) =>
	makeSnapshot(
		cardRange(1, LEARN_ROUND_CARDS),
		{},
		{ roundBy: 'count', round: { cards: cardRange(1, LEARN_ROUND_CARDS), ...round }, ...rest }
	);

/** @see BUILD_PLAN §6.4; Decisions log "Phase 8.6 step 5: count rounds" */
describe('planSession roundBy', () => {
	const total = LEARN_ROUND_CARDS + 5;
	const cards = Array.from({ length: total }, (_, i) => planCard(i + 1, 'cloze'));
	const plan = (roundBy?: 'count' | 'clock', list = cards) =>
		planSession({ cards: list, confusionEvents: [], now: T0, ...(roundBy ? { roundBy } : {}) });

	it("stores roundBy 'count' and fills round 1 with up to LEARN_ROUND_CARDS cards", () => {
		const { result } = plan('count');
		expect(result.roundBy).toBe('count');
		expect(result.queue).toEqual(cardRange(1, LEARN_ROUND_CARDS));
		expect(result.round.cards).toEqual(result.queue);
	});

	it('puts the remaining cards in the backlog, in plan order', () => {
		const { result } = plan('count');
		expect(result.backlog).toEqual(cardRange(LEARN_ROUND_CARDS + 1, total - LEARN_ROUND_CARDS));
	});

	it('holds all cards in round 1 when there are fewer than LEARN_ROUND_CARDS', () => {
		const few = cards.slice(0, ROUND_WORKING_SET + 1);
		const { result } = plan('count', few);
		expect(result.queue).toHaveLength(few.length);
		expect(result.backlog).toEqual([]);
	});

	it('leaves roundBy absent and uses ROUND_WORKING_SET without the option', () => {
		const { result } = plan();
		expect(result.roundBy).toBeUndefined();
		expect(result.queue).toEqual(cardRange(1, ROUND_WORKING_SET));
	});

	it("treats roundBy 'clock' like the default working set", () => {
		expect(plan('clock').result.queue).toEqual(cardRange(1, ROUND_WORKING_SET));
	});

	it('is deterministic for the same input, trace included', () => {
		expect(plan('count')).toEqual(plan('count'));
	});
});

/** @see Decisions log "Phase 8.6 Q16" */
describe('checkRoundEnd for a count round', () => {
	it('ends when all its cards are done, changing nothing else', () => {
		const all = Object.fromEntries(ids(1, 2, 3).map((id) => [id, done]));
		const state = makeSnapshot([], all, {
			roundBy: 'count',
			backlog: ids(10),
			round: { cards: ids(1, 2, 3), answers: 3 }
		});
		expect(end(state)).toEqual({ ...state, round: { ...state.round, ended: true } });
	});

	it('ends exactly when round.answers reaches LEARN_ROUND_CARDS', () => {
		expect(end(countRound({ answers: LEARN_ROUND_CARDS })).round.ended).toBe(true);
	});

	it('does not end one answer before LEARN_ROUND_CARDS', () => {
		const state = countRound({ answers: LEARN_ROUND_CARDS - 1 });
		expect(end(state)).toEqual(state);
	});

	it('ends after more than LEARN_ROUND_CARDS answers too', () => {
		expect(end(countRound({ answers: LEARN_ROUND_CARDS + 3 })).round.ended).toBe(true);
	});

	it('never ends by minutes, even hours after startedAt', () => {
		const state = countRound({ answers: 1 });
		expect(end(state, T0 + ROUND_MS)).toEqual(state);
		expect(end(state, T0 + HOURS_MS)).toEqual(state);
	});

	it('ends by the LEARN_ROUND_CARDS count, not the larger ROUND_MAX_ANSWERS', () => {
		expect(LEARN_ROUND_CARDS).toBeLessThan(ROUND_MAX_ANSWERS);
		expect(end(countRound({ answers: LEARN_ROUND_CARDS })).round.ended).toBe(true);
	});

	it('never ends while a card is being cleared, even at the answer limit', () => {
		const state = countRound({ answers: LEARN_ROUND_CARDS + 5 }, { clearing: cardId(1) });
		expect(end(state, T0 + HOURS_MS)).toEqual(state);
	});

	it('returns an already-ended round unchanged', () => {
		const state = countRound({ answers: LEARN_ROUND_CARDS, ended: true });
		expect(end(state)).toEqual(state);
	});
});

/** @see BUILD_PLAN §6.4 (rounds) */
describe('startRound for a count round', () => {
	const endedCount = (queue: SessionSnapshot['queue'], backlogCount: number) =>
		makeSnapshot(
			queue,
			{},
			{
				roundBy: 'count',
				backlog: cardRange(100, backlogCount),
				round: { cards: queue, answers: LEARN_ROUND_CARDS, ended: true }
			}
		);

	it('keeps roundBy and opens the next round', () => {
		const { result } = startRound(endedCount(ids(1, 2), 30), T0 + MINUTE, CONTINUE);
		expect(result.roundBy).toBe('count');
		expect(result.round).toMatchObject({ index: 2, answers: 0, ended: false });
	});

	it('carries unfinished cards first, then fills from the backlog up to LEARN_ROUND_CARDS', () => {
		const { result } = startRound(endedCount(ids(1, 2, 3), 30), T0 + MINUTE, CONTINUE);
		const filled = LEARN_ROUND_CARDS - 3;
		expect(result.queue).toHaveLength(LEARN_ROUND_CARDS);
		expect(result.queue.slice(0, 3)).toEqual(ids(1, 2, 3));
		expect(result.queue.slice(3)).toEqual(cardRange(100, filled));
		expect(result.backlog).toEqual(cardRange(100 + filled, 30 - filled));
		expect(result.round.cards).toEqual(result.queue);
	});

	it('takes the whole backlog when it is shorter than the free slots', () => {
		const { result } = startRound(endedCount([], 4), T0, CONTINUE);
		expect(result.queue).toEqual(cardRange(100, 4));
		expect(result.backlog).toEqual([]);
	});

	it('does not start while the round has not ended', () => {
		const state = makeSnapshot(ids(1), {}, { roundBy: 'count', backlog: ids(5) });
		expect(startRound(state, T0, CONTINUE).result).toEqual(state);
	});

	it('keeps roundBy after a break and restarts studySince', () => {
		const now = T0 + HOURS_MS;
		const { result } = startRound(endedCount(ids(1), 5), now, { afterBreak: true });
		expect(result.roundBy).toBe('count');
		expect(result.studySince).toBe(now);
	});

	it('roundSummary counts the carried and remaining cards of the ended round', () => {
		const s = roundSummary(endedCount(ids(2, 3), 5), T0 + MINUTE);
		expect(s.index).toBe(1);
		expect(s.carried).toBe(2);
		expect(s.remaining).toBe(7);
	});
});

/** Clock rounds are unchanged. @see BUILD_PLAN §6.4 */
describe.each([undefined, 'clock' as const])('clock round (roundBy %s)', (roundBy) => {
	const by = roundBy ? { roundBy } : {};
	const clock = (round = {}) =>
		makeSnapshot(
			cardRange(1, ROUND_WORKING_SET),
			{},
			{ ...by, round: { cards: cardRange(1, ROUND_WORKING_SET), ...round } }
		);

	it('does not end at LEARN_ROUND_CARDS answers (below ROUND_MAX_ANSWERS)', () => {
		const state = clock({ answers: LEARN_ROUND_CARDS });
		expect(end(state)).toEqual(state);
	});

	it('ends at ROUND_MAX_ANSWERS answers', () => {
		expect(end(clock({ answers: ROUND_MAX_ANSWERS })).round.ended).toBe(true);
	});

	it('ends after ROUND_MAX_MINUTES minutes', () => {
		expect(end(clock({ answers: 1 }), T0 + ROUND_MS).round.ended).toBe(true);
	});

	it('refills to ROUND_WORKING_SET on startRound', () => {
		const state = makeSnapshot(
			[],
			{},
			{ ...by, backlog: cardRange(100, 30), round: { cards: [], ended: true } }
		);
		const { result } = startRound(state, T0, CONTINUE);
		expect(result.queue).toHaveLength(ROUND_WORKING_SET);
	});
});

/** @see DATA_MODEL §3.7 row `snapshot` */
describe('SessionSnapshotSchema roundBy', () => {
	it('parses a stored snapshot without roundBy', () => {
		const parsed = SessionSnapshotSchema.parse(makeSnapshot(ids(1)));
		expect(parsed.roundBy).toBeUndefined();
	});

	it("round-trips roundBy 'count'", () => {
		const snap = makeSnapshot(ids(1), {}, { roundBy: 'count' });
		const parsed = SessionSnapshotSchema.parse(JSON.parse(JSON.stringify(snap)));
		expect(parsed).toEqual(snap);
	});

	it('rejects an unknown roundBy value', () => {
		const bad = { ...makeSnapshot(ids(1)), roundBy: 'weekly' };
		expect(() => SessionSnapshotSchema.parse(bad)).toThrow();
	});
});
