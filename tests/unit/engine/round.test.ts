import { describe, expect, it } from 'vitest';
import {
	BREAK_MIN,
	BREAK_SUGGEST_AFTER_MIN,
	CRITERION_FIRST,
	ERROR_LAG,
	LAGS,
	ROUND_MAX_ANSWERS,
	ROUND_MAX_MINUTES,
	ROUND_WORKING_SET
} from '#lib/config/defaults.ts';
import type { CardId } from '#lib/db/schemas/common.ts';
import type { SessionSnapshot } from '#lib/db/schemas/session.ts';
import { SessionSnapshotSchema } from '#lib/db/schemas/session.ts';
import { applyAnswer, currentItem } from '#lib/engine/queue.ts';
import { checkRoundEnd, roundSummary, startRound } from '#lib/engine/round.ts';
import { isSessionComplete, planSession, sessionPhase, startCleanup } from '#lib/engine/session.ts';
import { cardId, deepFreeze } from './fixtures.ts';
import {
	at,
	cardOf,
	cardRange,
	makeSnapshot,
	MINUTE,
	planCard,
	qa,
	T0
} from './session-fixtures.ts';

const ROUND_MS = ROUND_MAX_MINUTES * MINUTE;
const BREAK_AFTER_MS = BREAK_SUGGEST_AFTER_MIN * MINUTE;
const N = cardId(1);
const CONTINUE = { afterBreak: false };
const BREAK = { afterBreak: true };

const end = (state: SessionSnapshot, now = T0) => checkRoundEnd(state, now).result;
const apply = (state: SessionSnapshot, id: CardId, correct: boolean) =>
	applyAnswer(state, qa(id, correct)).result;
/** `state` with only `round.ended` set. */
const ended = (state: SessionSnapshot): SessionSnapshot => ({
	...state,
	round: { ...state.round, ended: true }
});

/** @see BUILD_PLAN §6.4 (rounds) and Decisions log (rounds) */
describe('round 1 from planSession', () => {
	it('holds at most ROUND_WORKING_SET cards, in plan order, and records them', () => {
		const total = ROUND_WORKING_SET * 2 + 1;
		const cards = Array.from({ length: total }, (_, i) => planCard(i + 1, 'cloze'));
		const { result } = planSession({ cards, confusionEvents: [], now: T0 });
		expect(result.queue).toEqual(cardRange(1, ROUND_WORKING_SET));
		expect(result.backlog).toEqual(cardRange(ROUND_WORKING_SET + 1, total - ROUND_WORKING_SET));
		expect(result.round).toMatchObject({ index: 1, startedAt: T0, answers: 0, ended: false });
		expect(result.round.cards).toEqual(result.queue);
	});
});

/** @see BUILD_PLAN §6.4 (rounds) */
describe('checkRoundEnd', () => {
	/** Round of cards 1–3 with card 1 done; 2 and 3 still in play. */
	const midRound = (round = {}, rest = {}) =>
		makeSnapshot(
			ids(2, 3),
			{ [cardId(1)]: { done: true, count: 1, lastFull: true } },
			{ round: { cards: ids(1, 2, 3), answers: 5, ...round }, ...rest }
		);

	it('ends the round when all its cards are done, changing nothing else', () => {
		const done = { done: true, count: 1, lastFull: true };
		const state = makeSnapshot(
			[],
			{ [cardId(1)]: done, [cardId(2)]: done, [cardId(3)]: done },
			{ backlog: ids(10, 11), round: { cards: ids(1, 2, 3), answers: 3 } }
		);
		expect(end(state, T0 + MINUTE)).toEqual(ended(state));
	});

	it('ends the round once the last of its cards meets the criterion through answers', () => {
		let state = makeSnapshot(ids(1, 2, 3), {}, { backlog: ids(10, 11) });
		for (const id of ids(1, 2, 3)) state = apply(state, id, true);
		const next = end(state, T0 + MINUTE);
		expect(next.round.ended).toBe(true);
		expect(next.backlog).toEqual(ids(10, 11));
	});

	it('does not end the round while one of its cards is unfinished, under both limits', () => {
		const state = midRound({ answers: ROUND_MAX_ANSWERS - 1 });
		expect(end(state, T0 + ROUND_MS - 1)).toEqual(state);
	});

	it('does not end at ROUND_MAX_ANSWERS − 1 answers', () => {
		const state = midRound({ answers: ROUND_MAX_ANSWERS - 1 });
		expect(end(state).round.ended).toBe(false);
	});

	it('ends at exactly ROUND_MAX_ANSWERS answers, keeping unfinished cards in the queue', () => {
		const state = midRound({ answers: ROUND_MAX_ANSWERS });
		expect(end(state)).toEqual(ended(state));
	});

	it('ends past ROUND_MAX_ANSWERS answers', () => {
		expect(end(midRound({ answers: ROUND_MAX_ANSWERS + 3 })).round.ended).toBe(true);
	});

	it('does not end one ms before ROUND_MAX_MINUTES', () => {
		expect(end(midRound(), T0 + ROUND_MS - 1).round.ended).toBe(false);
	});

	it('ends at exactly ROUND_MAX_MINUTES after the round started', () => {
		const state = midRound();
		expect(end(state, T0 + ROUND_MS)).toEqual(ended(state));
	});

	it('measures the time from round.startedAt, not from studySince', () => {
		const startedAt = T0 + 3 * ROUND_MS;
		const state = midRound({ startedAt });
		expect(end(state, startedAt + ROUND_MS - 1).round.ended).toBe(false);
		expect(end(state, startedAt + ROUND_MS).round.ended).toBe(true);
	});

	it('never ends while a card is being cleared, even past ROUND_MAX_ANSWERS', () => {
		const state = midRound({ answers: ROUND_MAX_ANSWERS + 1 }, { clearing: cardId(2) });
		expect(end(state)).toEqual(state);
	});

	it('never ends while a card is being cleared, even past ROUND_MAX_MINUTES', () => {
		const state = midRound({}, { clearing: cardId(2) });
		expect(end(state, T0 + ROUND_MS * 2)).toEqual(state);
	});

	it('ends at the first answer that clears the redo once the answer limit has passed', () => {
		const others = cardRange(100, ERROR_LAG + 2);
		let state = makeSnapshot([N, ...others], {}, { round: { answers: ROUND_MAX_ANSWERS - 1 } });
		state = apply(state, N, false);
		expect(state.round.answers).toBe(ROUND_MAX_ANSWERS);
		expect(end(state).round.ended).toBe(false);
		state = apply(state, N, false);
		expect(end(state).round.ended).toBe(false);
		state = apply(state, N, true);
		expect(state.clearing).toBeNull();
		const next = end(state);
		expect(next.round.ended).toBe(true);
		expect(next.queue).toContain(N);
	});

	it('ends at the first answer that clears the redo once the time limit has passed', () => {
		let state = makeSnapshot([N, ...cardRange(100, 4)]);
		state = apply(state, N, false);
		expect(end(state, T0 + ROUND_MS).round.ended).toBe(false);
		state = apply(state, N, true);
		expect(end(state, T0 + ROUND_MS).round.ended).toBe(true);
	});

	it('returns the state unchanged when the round already ended', () => {
		const state = ended(midRound({ answers: ROUND_MAX_ANSWERS }));
		expect(end(state, T0 + ROUND_MS)).toEqual(state);
	});

	it('blocks further answers once ended', () => {
		const state = end(midRound({ answers: ROUND_MAX_ANSWERS }));
		expect(currentItem(state)).toBeNull();
		expect(() => applyAnswer(state, qa(cardId(2), true))).toThrow();
	});
});

/** @see BUILD_PLAN §6.4 (rounds), DATA_MODEL §3.7 */
describe('startRound', () => {
	const A = cardId(1);
	const B = cardId(2);
	const BACKLOG = cardRange(10, ROUND_WORKING_SET + 2);
	const NOW = T0 + 2 * ROUND_MS;

	/** Round 2 ended with A (count 1 of CRITERION_FIRST) and B (failed) unfinished. */
	function endedRound(queue: readonly CardId[] = [B, A], backlog = BACKLOG): SessionSnapshot {
		return makeSnapshot(
			queue,
			{
				[A]: { phase: 'new', required: CRITERION_FIRST, count: 1, lastFull: true, attempt: 3 },
				[B]: { failed: true, attempt: 4 },
				[cardId(3)]: { done: true, count: 1, lastFull: true }
			},
			{
				backlog,
				round: { index: 2, answers: ROUND_MAX_ANSWERS, cards: [...queue, cardId(3)], ended: true }
			}
		);
	}

	it('carries unfinished cards first, in their order, then fills from the backlog', () => {
		const { result } = startRound(endedRound(), NOW, CONTINUE);
		const fill = ROUND_WORKING_SET - 2;
		expect(result.queue).toEqual([B, A, ...BACKLOG.slice(0, fill)]);
		expect(result.backlog).toEqual(BACKLOG.slice(fill));
	});

	it('keeps carried cards in their order whatever their IDs', () => {
		expect(startRound(endedRound([A, B]), NOW, CONTINUE).result.queue.slice(0, 2)).toEqual([A, B]);
	});

	it('keeps carried cards with their counts and state', () => {
		const state = endedRound();
		const { result } = startRound(state, NOW, CONTINUE);
		expect(cardOf(result, A)).toEqual(cardOf(state, A));
		expect(cardOf(result, B)).toEqual(cardOf(state, B));
	});

	it('fills the whole working set from the backlog when nothing is carried', () => {
		const { result } = startRound(endedRound([]), NOW, CONTINUE);
		expect(result.queue).toEqual(BACKLOG.slice(0, ROUND_WORKING_SET));
		expect(result.backlog).toEqual(BACKLOG.slice(ROUND_WORKING_SET));
	});

	it('takes the whole backlog when fewer cards remain than the working set', () => {
		const { result } = startRound(endedRound([B], ids(10, 11)), NOW, CONTINUE);
		expect(result.queue).toEqual([B, ...ids(10, 11)]);
		expect(result.backlog).toEqual([]);
	});

	it('carries cards over even with an empty backlog', () => {
		const { result } = startRound(endedRound([B, A], []), NOW, CONTINUE);
		expect(result.queue).toEqual([B, A]);
	});

	it('opens the next round: index + 1, started now, no answers, records its cards, not ended', () => {
		const { result } = startRound(endedRound(), NOW, CONTINUE);
		expect(result.round).toEqual({
			index: 3,
			startedAt: NOW,
			answers: 0,
			cards: result.queue,
			ended: false
		});
		expect(currentItem(result)?.cardId).toBe(B);
	});

	it('restarts studySince at now after a break', () => {
		expect(startRound(endedRound(), NOW, BREAK).result.studySince).toBe(NOW);
	});

	it('keeps studySince when continuing without a break', () => {
		expect(startRound(endedRound(), NOW, CONTINUE).result.studySince).toBe(T0);
	});

	it('leaves backlog cards and cleanup as they were', () => {
		const state = endedRound();
		const { result } = startRound(state, NOW, CONTINUE);
		expect(cardOf(result, at(BACKLOG, 0))).toEqual(cardOf(state, at(BACKLOG, 0)));
		expect(result.cleanup).toBe(state.cleanup);
		expect(result.clearing).toBeNull();
	});

	it('returns the state unchanged when the round has not ended', () => {
		const state = { ...endedRound(), round: { ...endedRound().round, ended: false } };
		expect(startRound(state, NOW, BREAK).result).toEqual(state);
	});

	it('returns the state unchanged when no cards are left', () => {
		const state = endedRound([], []);
		expect(startRound(state, NOW, BREAK).result).toEqual(state);
	});
});

/** @see BUILD_PLAN §6.4 (round summary), DESIGN §5 */
describe('roundSummary', () => {
	/** Round 4 of cards 1–5: 1–3 done, 4–5 unfinished; 6–8 in the backlog; 99 done earlier. */
	function summaryState(studySince = T0): SessionSnapshot {
		const done = { done: true, count: 1, lastFull: true };
		return makeSnapshot(
			ids(4, 5),
			{ [cardId(1)]: done, [cardId(2)]: done, [cardId(3)]: done, [cardId(99)]: done },
			{
				backlog: ids(6, 7, 8),
				studySince,
				round: { index: 4, cards: ids(1, 2, 3, 4, 5), answers: ROUND_MAX_ANSWERS, ended: true }
			}
		);
	}

	it('counts finished and carried cards of this round and the cards remaining', () => {
		expect(roundSummary(summaryState(), T0 + MINUTE)).toMatchObject({
			index: 4,
			finished: 3,
			carried: 2,
			remaining: 2 + 3
		});
	});

	it('counts no carried cards when the whole round finished', () => {
		const done = { done: true, count: 1, lastFull: true };
		const state = makeSnapshot(
			[],
			{ [cardId(1)]: done, [cardId(2)]: done },
			{ backlog: ids(6), round: { cards: ids(1, 2), ended: true } }
		);
		expect(roundSummary(state, T0)).toMatchObject({ finished: 2, carried: 0, remaining: 1 });
	});

	it('does not suggest a break one ms before BREAK_SUGGEST_AFTER_MIN', () => {
		const summary = roundSummary(summaryState(), T0 + BREAK_AFTER_MS - 1);
		expect(summary.suggestBreak).toBe(false);
		expect(summary.breakMinutes).toBe(BREAK_MIN);
	});

	it('suggests a BREAK_MIN break at exactly BREAK_SUGGEST_AFTER_MIN since studySince', () => {
		const summary = roundSummary(summaryState(), T0 + BREAK_AFTER_MS);
		expect(summary.suggestBreak).toBe(true);
		expect(summary.breakMinutes).toBe(BREAK_MIN);
	});

	it('measures from studySince (the end of the last break), not the session start', () => {
		const since = T0 + 2 * BREAK_AFTER_MS;
		expect(roundSummary(summaryState(since), since + BREAK_AFTER_MS - 1).suggestBreak).toBe(false);
		expect(roundSummary(summaryState(since), since + BREAK_AFTER_MS).suggestBreak).toBe(true);
	});

	it('suggests a break after a break was taken only once studySince is old enough again', () => {
		const after = startRound(
			{ ...summaryState(), round: { ...summaryState().round } },
			T0 + BREAK_AFTER_MS,
			BREAK
		).result;
		expect(roundSummary(after, T0 + BREAK_AFTER_MS + MINUTE).suggestBreak).toBe(false);
	});

	it('is deterministic and does not mutate its input', () => {
		const state = summaryState();
		const frozen = deepFreeze(structuredClone(state));
		expect(roundSummary(frozen, T0 + BREAK_AFTER_MS)).toEqual(
			roundSummary(state, T0 + BREAK_AFTER_MS)
		);
		expect(frozen).toEqual(state);
	});
});

/** @see BUILD_PLAN §6.4 (lags reinsert within the round) */
describe('lags inside a round', () => {
	const others = cardRange(100, ROUND_WORKING_SET - 1);
	const backlog = cardRange(200, 5);
	const round = (extra = {}) =>
		makeSnapshot(
			[N, ...others],
			{ [N]: { phase: 'new', required: CRITERION_FIRST, ...extra } },
			{ backlog }
		);

	it('reinserts within the round queue when the round is long enough for the lag', () => {
		const next = apply(round(), N, true);
		expect(next.queue.indexOf(N)).toBe(LAGS[0]);
		expect(next.backlog).toEqual(backlog);
	});

	it('appends to the end of the round when the round is shorter than the lag', () => {
		const next = apply(round({ count: 1, lastFull: true }), N, true);
		expect(LAGS[1]).toBeGreaterThan(others.length);
		expect(next.queue).toEqual([...others, N]);
		expect(next.backlog).toEqual(backlog);
	});

	it('reinserts a cleared card at ERROR_LAG within the round, never into the backlog', () => {
		let next = apply(round(), N, false);
		next = apply(next, N, true);
		expect(next.queue.indexOf(N)).toBe(ERROR_LAG);
		expect(next.backlog).toEqual(backlog);
	});
});

/** @see CONCEPT §6, BUILD_PLAN §6.4 and Decisions log (rounds: cleanup cards go into the backlog) */
describe('cleanup cards flow into a round', () => {
	const failed = cardRange(1, ROUND_WORKING_SET + 2);
	function finished(): SessionSnapshot {
		const cards = Object.fromEntries(
			failed.map((id) => [id, { done: true, failed: true, count: 1, lastFull: true }])
		);
		return makeSnapshot([], cards, { round: { cards: failed.slice(0, 3), ended: true } });
	}
	/** Lower retrievability for higher IDs, so cleanup order is reverse ID order. */
	const R = Object.fromEntries(failed.map((id, i) => [id, 1 - i / failed.length]));

	it('opens a round of the weakest ROUND_WORKING_SET cleanup cards, the rest in the backlog', () => {
		const cleanup = startCleanup(finished(), R).result;
		const { result } = startRound(cleanup, T0, CONTINUE);
		const order = [...failed].reverse();
		expect(result.queue).toEqual(order.slice(0, ROUND_WORKING_SET));
		expect(result.backlog).toEqual(order.slice(ROUND_WORKING_SET));
		expect(sessionPhase(result)).toBe('cleanup');
		expect(currentItem(result)?.phase).toBe('cleanup');
	});
});

/** @see BUILD_PLAN §6.4, CONCEPT §6 */
describe('a session over two rounds', () => {
	it('plans, ends round 1, summarises, continues, finishes and completes', () => {
		const total = ROUND_WORKING_SET + 2;
		const cards = Array.from({ length: total }, (_, i) => planCard(i + 1, 'cloze'));
		let s = planSession({ cards, confusionEvents: [], now: T0 }).result;

		for (const id of cardRange(1, ROUND_WORKING_SET)) s = apply(s, id, true);
		expect(end(s, T0 + MINUTE)).not.toEqual(s);
		s = end(s, T0 + MINUTE);
		expect(roundSummary(s, T0 + MINUTE)).toEqual({
			index: 1,
			finished: ROUND_WORKING_SET,
			carried: 0,
			remaining: 2,
			suggestBreak: false,
			breakMinutes: BREAK_MIN
		});
		expect(() => applyAnswer(s, qa(cardId(ROUND_WORKING_SET + 1), true))).toThrow();

		s = startRound(s, T0 + 2 * MINUTE, CONTINUE).result;
		expect(s.round.index).toBe(2);
		expect(s.queue).toEqual(cardRange(ROUND_WORKING_SET + 1, 2));
		for (const id of cardRange(ROUND_WORKING_SET + 1, 2)) s = apply(s, id, true);
		s = end(s, T0 + 3 * MINUTE);
		expect(s.round.ended).toBe(true);

		s = startCleanup(s, {}).result;
		expect(isSessionComplete(s)).toBe(true);
	});
});

/** @see DATA_MODEL §3.7, BUILD_PLAN §11.5 */
describe('round functions: purity, shape and determinism', () => {
	const live = makeSnapshot(
		ids(2, 3),
		{ [cardId(1)]: { done: true } },
		{
			backlog: cardRange(10, ROUND_WORKING_SET),
			round: { cards: ids(1, 2, 3), answers: ROUND_MAX_ANSWERS }
		}
	);
	const over = ended(live);

	const cases: [string, () => ReturnType<typeof checkRoundEnd>, SessionSnapshot][] = [
		['checkRoundEnd ending a round', () => checkRoundEnd(live, T0), live],
		['checkRoundEnd leaving a round', () => checkRoundEnd(over, T0), over],
		['startRound after a break', () => startRound(over, T0 + ROUND_MS, BREAK), over],
		['startRound continuing', () => startRound(over, T0 + ROUND_MS, CONTINUE), over]
	];

	for (const [label, run] of cases) {
		it(`${label}: returns a snapshot that parses with SessionSnapshotSchema`, () => {
			expect(() => SessionSnapshotSchema.parse(run().result)).not.toThrow();
		});

		it(`${label}: is deterministic, identical result and trace`, () => {
			expect(run()).toEqual(run());
			expect(Array.isArray(run().trace)).toBe(true);
		});
	}

	it('checkRoundEnd does not mutate its input', () => {
		const frozen = deepFreeze(structuredClone(live));
		expect(() => checkRoundEnd(frozen, T0 + ROUND_MS)).not.toThrow();
		expect(frozen).toEqual(live);
	});

	it('startRound does not mutate its input', () => {
		const frozen = deepFreeze(structuredClone(over));
		expect(() => startRound(frozen, T0 + ROUND_MS, BREAK)).not.toThrow();
		expect(frozen).toEqual(over);
	});
});

function ids(...ns: number[]): CardId[] {
	return ns.map(cardId);
}
