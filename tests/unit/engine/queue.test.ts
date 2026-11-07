import { describe, expect, it } from 'vitest';
import {
	CRITERION_FIRST,
	CRITERION_FIRST_REDUCED,
	CRITERION_LATER,
	ERROR_LAG,
	LAGS
} from '#lib/config/defaults.ts';
import type { CardId } from '#lib/db/schemas/common.ts';
import type { SessionSnapshot } from '#lib/db/schemas/session.ts';
import { SessionSnapshotSchema } from '#lib/db/schemas/session.ts';
import type { QueueAnswer } from '#lib/engine/queue.ts';
import { applyAnswer, currentItem, lagAfterCorrect, reinsert } from '#lib/engine/queue.ts';
import { cardId, deepFreeze } from './fixtures.ts';
import { at, cardOf, cardRange, makeSnapshot, qa } from './session-fixtures.ts';

const LAST_LAG = at(LAGS, LAGS.length - 1);
const N = cardId(1);
/** Enough other cards that every lag fits. */
const OTHERS = cardRange(100, LAST_LAG + 10);

const apply = (state: SessionSnapshot, answer: QueueAnswer) => applyAnswer(state, answer).result;

/** A new card at the head (needs CRITERION_FIRST) in front of `others`, which each need 1. */
function newCardQueue(others: readonly CardId[] = OTHERS, extra = {}): SessionSnapshot {
	return makeSnapshot([N, ...others], {
		[N]: { phase: 'new', required: CRITERION_FIRST, ...extra }
	});
}

/** @see BUILD_PLAN §6.4 and Decisions log (lags) */
describe('lagAfterCorrect', () => {
	it('follows LAGS for counts 1 to LAGS.length', () => {
		LAGS.forEach((lag, i) => expect(lagAfterCorrect(i + 1)).toBe(lag));
	});

	it('repeats the last lag once the count passes LAGS.length', () => {
		expect(lagAfterCorrect(LAGS.length + 1)).toBe(LAST_LAG);
		expect(lagAfterCorrect(LAGS.length + 5)).toBe(LAST_LAG);
	});
});

/** @see BUILD_PLAN §6.4 and Decisions log (lags) */
describe('reinsert', () => {
	const Q = cardRange(1, 8);

	it('puts `lag` other cards before the old head', () => {
		expect(reinsert(Q, 3)).toEqual([
			at(Q, 1),
			at(Q, 2),
			at(Q, 3),
			at(Q, 0),
			at(Q, 4),
			at(Q, 5),
			at(Q, 6),
			at(Q, 7)
		]);
	});

	it('keeps the order of the other cards', () => {
		const out = reinsert(Q, 5);
		expect(out.filter((id) => id !== at(Q, 0))).toEqual(Q.slice(1));
		expect(out.indexOf(at(Q, 0))).toBe(5);
	});

	it('appends the head when the queue is shorter than the lag', () => {
		const short = cardRange(1, 3);
		expect(reinsert(short, 5)).toEqual([at(short, 1), at(short, 2), at(short, 0)]);
	});

	it('appends the head when exactly `lag` other cards follow it', () => {
		const q = cardRange(1, 4);
		expect(reinsert(q, 3)).toEqual([at(q, 1), at(q, 2), at(q, 3), at(q, 0)]);
	});

	it('leaves a one-card queue as it is', () => {
		expect(reinsert([N], ERROR_LAG)).toEqual([N]);
	});

	it('does not mutate its input', () => {
		const frozen = deepFreeze([...Q]);
		expect(reinsert(frozen, 2)).toHaveLength(Q.length);
		expect(frozen).toEqual(Q);
	});
});

/** @see BUILD_PLAN §6.4 and DATA_MODEL §3.7 */
describe('currentItem', () => {
	it('returns null when the queue is empty', () => {
		expect(currentItem(makeSnapshot([], {}, { cleanup: true }))).toBeNull();
	});

	it('returns the head card with its attempt and phase, as a first attempt', () => {
		const state = makeSnapshot([N, cardId(2)], { [N]: { phase: 'new', attempt: 2 } });
		// SPEC-GAP: is `attempt` the stored presentations-so-far (read here) or that plus one?
		expect(currentItem(state)).toEqual({
			cardId: N,
			attempt: 2,
			firstAttempt: true,
			phase: 'new',
			count: 0,
			required: 1
		});
	});

	it('carries the card count and required for the progress dots', () => {
		const state = makeSnapshot([N], {
			[N]: { required: CRITERION_FIRST, count: 2, lastFull: true }
		});
		expect(currentItem(state)).toMatchObject({ count: 2, required: CRITERION_FIRST });
	});

	it('returns null once the round has ended, even with cards left in the queue', () => {
		const state = makeSnapshot([N, cardId(2)], {}, { round: { ended: true } });
		expect(currentItem(state)).toBeNull();
	});

	it('marks the head as not a first attempt while it is being cleared', () => {
		const state = makeSnapshot([N], { [N]: { attempt: 1, failed: true } }, { clearing: N });
		expect(currentItem(state)?.firstAttempt).toBe(false);
	});
});

/** @see BUILD_PLAN §6.3, §6.4 and Decisions log (lags, redo-till-right) */
describe('applyAnswer: corrects and lags', () => {
	it('reinserts a new card at LAGS[0] after its first correct', () => {
		const next = apply(newCardQueue(), qa(N, true));
		expect(next.queue.indexOf(N)).toBe(LAGS[0]);
		expect(cardOf(next, N)).toMatchObject({ count: 1, lastFull: true, done: false, attempt: 1 });
	});

	it('reinserts at LAGS[1] after the second correct', () => {
		const next = apply(newCardQueue(OTHERS, { count: 1, lastFull: true, attempt: 1 }), qa(N, true));
		expect(next.queue.indexOf(N)).toBe(LAGS[1]);
		expect(cardOf(next, N).count).toBe(2);
	});

	it('finishes the card at CRITERION_FIRST full corrects and removes it from the queue', () => {
		const state = newCardQueue(OTHERS, { count: CRITERION_FIRST - 1, lastFull: true });
		const next = apply(state, qa(N, true));
		expect(next.queue).not.toContain(N);
		expect(next.queue).toEqual(OTHERS);
		expect(cardOf(next, N)).toMatchObject({ done: true, count: CRITERION_FIRST, lastFull: true });
	});

	it('does not finish a card whose reaching correct is recognition; reinserts at the last lag', () => {
		const state = newCardQueue(OTHERS, { count: CRITERION_FIRST - 1, lastFull: true });
		const next = apply(state, qa(N, true, 'recognition'));
		expect(cardOf(next, N)).toMatchObject({ done: false, count: CRITERION_FIRST, lastFull: false });
		expect(next.queue.indexOf(N)).toBe(lagAfterCorrect(CRITERION_FIRST));
	});

	it('repeats the last lag for a further recognition correct, then finishes on a full one', () => {
		const state = newCardQueue(OTHERS, { count: LAGS.length, lastFull: false });
		const after = apply(state, qa(N, true, 'recognition'));
		expect(after.queue.indexOf(N)).toBe(LAST_LAG);
		expect(cardOf(after, N).count).toBe(LAGS.length + 1);
		const atHead = makeSnapshot([N, ...OTHERS], { [N]: cardOf(after, N) });
		const done = apply(atHead, qa(N, true));
		expect(cardOf(done, N).done).toBe(true);
		expect(done.queue).not.toContain(N);
	});

	it('appends a correct card to the end when the queue is shorter than the lag', () => {
		const others = cardRange(100, 2);
		const next = apply(newCardQueue(others), qa(N, true));
		expect(next.queue).toEqual([...others, N]);
	});

	it('keeps a lone unfinished card at the head after a correct', () => {
		const next = apply(newCardQueue([]), qa(N, true));
		expect(next.queue).toEqual([N]);
		expect(currentItem(next)?.firstAttempt).toBe(true);
	});

	it('finishes a relearning card (required CRITERION_LATER) after one full correct', () => {
		const state = makeSnapshot([N, ...OTHERS], { [N]: { required: CRITERION_LATER } });
		const next = apply(state, qa(N, true));
		expect(cardOf(next, N).done).toBe(true);
		expect(next.queue).toEqual(OTHERS);
	});
});

/** @see BUILD_PLAN §6.4 and Decisions log (redo-till-right) */
describe('applyAnswer: wrong answers and redo-till-right', () => {
	it('keeps a wrong first attempt at the head as clearing, resets the count and marks it failed', () => {
		const state = newCardQueue(OTHERS, { count: 2, lastFull: true, attempt: 2 });
		const next = apply(state, qa(N, false));
		expect(next.queue).toEqual([N, ...OTHERS]);
		expect(next.clearing).toBe(N);
		expect(cardOf(next, N)).toMatchObject({ count: 0, failed: true, done: false, attempt: 3 });
		expect(currentItem(next)).toMatchObject({ cardId: N, firstAttempt: false, attempt: 3 });
	});

	it('keeps the card at the head after a wrong redo, still clearing, attempt incremented', () => {
		const state = makeSnapshot(
			[N, ...OTHERS],
			{ [N]: { failed: true, attempt: 1 } },
			{ clearing: N }
		);
		const next = apply(state, qa(N, false));
		expect(next.queue).toEqual([N, ...OTHERS]);
		expect(next.clearing).toBe(N);
		expect(cardOf(next, N)).toMatchObject({ count: 0, attempt: 2, failed: true });
	});

	it('reinserts a cleared card at ERROR_LAG without counting the redo', () => {
		const state = makeSnapshot(
			[N, ...OTHERS],
			{ [N]: { required: CRITERION_FIRST, failed: true, attempt: 2 } },
			{ clearing: N }
		);
		const next = apply(state, qa(N, true));
		expect(next.clearing).toBeNull();
		expect(next.queue.indexOf(N)).toBe(ERROR_LAG);
		expect(cardOf(next, N)).toMatchObject({ count: 0, attempt: 3, done: false, failed: true });
	});

	it('does not finish a card whose required corrects is reached only by a redo', () => {
		const state = makeSnapshot([N, ...OTHERS], { [N]: { failed: true } }, { clearing: N });
		const next = apply(state, qa(N, true));
		expect(cardOf(next, N).done).toBe(false);
		expect(next.queue).toContain(N);
	});

	it('gives each redo a new attempt number so options reshuffle', () => {
		let state = newCardQueue();
		const attempts: number[] = [];
		for (const correct of [false, false, false]) {
			state = apply(state, qa(N, correct));
			attempts.push(currentItem(state)?.attempt ?? -1);
		}
		expect(new Set(attempts).size).toBe(attempts.length);
		expect(cardOf(state, N).attempt).toBe(3);
	});

	it('appends a cleared card to the end when the queue is shorter than ERROR_LAG', () => {
		const others = cardRange(100, ERROR_LAG - 1);
		const state = makeSnapshot([N, ...others], { [N]: { failed: true } }, { clearing: N });
		expect(apply(state, qa(N, true)).queue).toEqual([...others, N]);
	});

	it('relearning failure: clears, reinserts at ERROR_LAG, then needs one full correct', () => {
		let state = makeSnapshot([N, ...OTHERS], { [N]: { required: CRITERION_LATER } });
		state = apply(state, qa(N, false));
		expect(state.clearing).toBe(N);
		expect(cardOf(state, N)).toMatchObject({ failed: true, count: 0, required: CRITERION_LATER });
		state = apply(state, qa(N, true));
		expect(state.queue.indexOf(N)).toBe(ERROR_LAG);
		expect(cardOf(state, N).done).toBe(false);
		for (let i = 0; i < ERROR_LAG; i++) state = apply(state, qa(at(state.queue, 0), true));
		expect(state.queue[0]).toBe(N);
		expect(currentItem(state)?.firstAttempt).toBe(true);
		state = apply(state, qa(N, true));
		expect(cardOf(state, N)).toMatchObject({ done: true, count: CRITERION_LATER, failed: true });
		expect(state.queue).not.toContain(N);
	});
});

/** @see BUILD_PLAN §6.3 and Decisions log (lags: a none-weight answer shows once) */
describe('applyAnswer: none-weight answers', () => {
	it('shows a none-weight card once: done and removed after a correct', () => {
		const state = makeSnapshot([N, ...OTHERS], { [N]: { phase: 'warmup' } });
		const next = apply(state, qa(N, true, 'none'));
		expect(next.queue).toEqual(OTHERS);
		expect(cardOf(next, N)).toMatchObject({ done: true, count: 0, attempt: 1, failed: false });
	});

	it('shows a none-weight card once even when wrong: no redo, no reset, not failed', () => {
		const state = makeSnapshot([N, ...OTHERS], { [N]: { phase: 'warmup' } });
		const next = apply(state, qa(N, false, 'none'));
		expect(next.queue).toEqual(OTHERS);
		expect(next.clearing).toBeNull();
		expect(cardOf(next, N)).toMatchObject({ done: true, count: 0, failed: false });
	});
});

/** @see BUILD_PLAN §6.3 and Decisions log (known on first try) */
describe('applyAnswer: first answer ever (firstEver)', () => {
	const firstEver = (extra = {}) => newCardQueue(OTHERS, { firstEver: true, ...extra });

	it('drops required to CRITERION_FIRST_REDUCED after a correct full first answer', () => {
		const next = apply(firstEver(), qa(N, true));
		expect(cardOf(next, N)).toMatchObject({
			required: Math.min(CRITERION_FIRST, CRITERION_FIRST_REDUCED),
			count: 1,
			firstEver: false
		});
	});

	it('drops required after a correct recognition first answer too', () => {
		const next = apply(firstEver(), qa(N, true, 'recognition'));
		expect(cardOf(next, N)).toMatchObject({ required: CRITERION_FIRST_REDUCED, firstEver: false });
	});

	it('still reinserts an unfinished card at lagAfterCorrect(1) after the drop', () => {
		const next = apply(firstEver(), qa(N, true));
		expect(next.queue.indexOf(N)).toBe(lagAfterCorrect(1));
	});

	it('drops required before the criterion check, so the reduced count can finish the card', () => {
		// Count preset so the drop alone decides whether this correct finishes the card.
		const state = firstEver({ count: CRITERION_FIRST_REDUCED - 1, lastFull: true });
		const next = apply(state, qa(N, true));
		expect(cardOf(next, N)).toMatchObject({
			done: true,
			count: CRITERION_FIRST_REDUCED,
			required: CRITERION_FIRST_REDUCED
		});
		expect(next.queue).not.toContain(N);
	});

	it('does not drop required after a wrong first answer, and firstEver is false afterwards', () => {
		const next = apply(firstEver(), qa(N, false));
		expect(cardOf(next, N)).toMatchObject({ required: CRITERION_FIRST, firstEver: false });
		expect(next.clearing).toBe(N);
	});

	it('does not drop required after a none-weight first answer, and firstEver is false afterwards', () => {
		const next = apply(firstEver(), qa(N, true, 'none'));
		expect(cardOf(next, N)).toMatchObject({ required: CRITERION_FIRST, firstEver: false });
	});

	it('does not drop required for a card whose first answer ever is not this one', () => {
		const next = apply(newCardQueue(), qa(N, true));
		expect(cardOf(next, N)).toMatchObject({ required: CRITERION_FIRST, firstEver: false });
	});

	it('only the first answer can drop it: a later correct after a wrong first answer does not', () => {
		let state = apply(firstEver(), qa(N, false));
		state = apply(state, qa(N, true));
		for (let i = 0; i < ERROR_LAG; i++) state = apply(state, qa(at(state.queue, 0), true));
		state = apply(state, qa(N, true));
		expect(cardOf(state, N)).toMatchObject({ required: CRITERION_FIRST, count: 1, done: false });
	});

	it('leaves a required already at or below CRITERION_FIRST_REDUCED unchanged', () => {
		const state = makeSnapshot([N, ...OTHERS], {
			[N]: { required: CRITERION_LATER, firstEver: true }
		});
		const next = apply(state, qa(N, true));
		expect(cardOf(next, N)).toMatchObject({
			required: CRITERION_LATER,
			done: true,
			firstEver: false
		});
	});
});

/** @see BUILD_PLAN §6.4 (rounds) and DATA_MODEL §3.7 */
describe('applyAnswer: round answers', () => {
	const cases: [string, SessionSnapshot, QueueAnswer][] = [
		['a correct', newCardQueue(), qa(N, true)],
		['a wrong', newCardQueue(), qa(N, false)],
		['a none-weight answer', newCardQueue(), qa(N, true, 'none')],
		[
			'a redo',
			makeSnapshot([N, ...OTHERS], { [N]: { failed: true } }, { clearing: N }),
			qa(N, false)
		]
	];

	for (const [label, state, answer] of cases) {
		it(`increments round.answers by one after ${label}`, () => {
			const before = { ...state, round: { ...state.round, answers: 7 } };
			expect(apply(before, answer).round.answers).toBe(8);
		});
	}

	it('counts every answer of a sequence, redo attempts included', () => {
		let state = newCardQueue();
		state = apply(state, qa(N, false));
		state = apply(state, qa(N, false));
		state = apply(state, qa(N, true));
		state = apply(state, qa(at(state.queue, 0), true));
		expect(state.round.answers).toBe(4);
	});

	it('does not end the round itself (checkRoundEnd does)', () => {
		// SPEC-GAP: applyAnswer's JSDoc lists no round ending and checkRoundEnd owns it; read as
		// applyAnswer never setting round.ended, even when its answer finishes the round's last card.
		const state = makeSnapshot([N], {}, { round: { answers: 0 } });
		expect(apply(state, qa(N, true)).round.ended).toBe(false);
	});
});

/** @see BUILD_PLAN §6.4 (caller bugs) */
describe('applyAnswer: guards', () => {
	it('throws for a card that is not at the head of the queue', () => {
		expect(() => applyAnswer(newCardQueue(), qa(at(OTHERS, 0), true))).toThrow();
	});

	it('throws for a card not in the session at all', () => {
		expect(() => applyAnswer(newCardQueue(), qa(cardId(9999), true))).toThrow();
	});

	it('throws once the round has ended', () => {
		const state = makeSnapshot([N, ...OTHERS], {}, { round: { ended: true } });
		expect(() => applyAnswer(state, qa(N, true))).toThrow();
	});

	it('throws when the queue is empty', () => {
		expect(() => applyAnswer(makeSnapshot([], { [N]: { done: true } }), qa(N, true))).toThrow();
	});
});

/** @see DATA_MODEL §3.7, BUILD_PLAN §11.5 */
describe('applyAnswer: purity, shape and determinism', () => {
	const cases: [string, SessionSnapshot, QueueAnswer][] = [
		['a correct', newCardQueue(), qa(N, true)],
		['a wrong', newCardQueue(), qa(N, false)],
		[
			'a finishing correct',
			newCardQueue(OTHERS, { count: CRITERION_FIRST - 1, lastFull: true }),
			qa(N, true)
		],
		['a none-weight answer', newCardQueue(), qa(N, true, 'none')],
		[
			'a clearing correct',
			makeSnapshot([N, ...OTHERS], { [N]: { failed: true } }, { clearing: N }),
			qa(N, true)
		],
		['a first-ever correct', newCardQueue(OTHERS, { firstEver: true }), qa(N, true)],
		[
			'an answer with a backlog waiting',
			makeSnapshot([N, ...cardRange(100, 3)], {}, { backlog: cardRange(200, 4) }),
			qa(N, true)
		]
	];

	for (const [label, state, answer] of cases) {
		it(`returns a snapshot that parses with SessionSnapshotSchema after ${label}`, () => {
			expect(() => SessionSnapshotSchema.parse(apply(state, answer))).not.toThrow();
		});

		it(`does not mutate its input after ${label}`, () => {
			const frozen = deepFreeze(structuredClone(state));
			expect(() => applyAnswer(frozen, answer)).not.toThrow();
			expect(frozen).toEqual(state);
		});

		it(`is deterministic after ${label}: identical result and trace`, () => {
			expect(applyAnswer(state, answer)).toEqual(applyAnswer(state, answer));
		});
	}

	it('returns a trace array', () => {
		expect(Array.isArray(applyAnswer(newCardQueue(), qa(N, true)).trace)).toBe(true);
	});
});

/** @see BUILD_PLAN §6.3, §6.4, CONCEPT §5 and Decisions log (lags, redo-till-right) */
describe('walkthrough: one new card among others, answered to completion', () => {
	/** Answers the other cards at the head (each needs 1) until N is at the head. */
	function drainTo(state: SessionSnapshot): SessionSnapshot {
		let next = state;
		while (next.queue[0] !== N) next = apply(next, qa(at(next.queue, 0), true));
		return next;
	}

	it('moves the card through LAGS, a redo-till-right, ERROR_LAG and back to done', () => {
		// Enough others that no lag in the walk is cut short by the queue end.
		let s = newCardQueue(cardRange(100, LAGS[0] + LAGS[1] + ERROR_LAG + LAGS[0] + LAGS[1] + 5));

		s = apply(s, qa(N, true));
		expect(s.queue.indexOf(N)).toBe(LAGS[0]);
		expect(cardOf(s, N)).toMatchObject({ count: 1, attempt: 1 });

		s = drainTo(s);
		expect(s.queue[0]).toBe(N);
		s = apply(s, qa(N, true));
		expect(s.queue.indexOf(N)).toBe(LAGS[1]);
		expect(cardOf(s, N)).toMatchObject({ count: 2, attempt: 2 });

		s = drainTo(s);
		s = apply(s, qa(N, false));
		expect(s.queue[0]).toBe(N);
		expect(s.clearing).toBe(N);
		expect(cardOf(s, N)).toMatchObject({ count: 0, failed: true, attempt: 3 });

		s = apply(s, qa(N, false));
		expect(s.queue[0]).toBe(N);
		expect(cardOf(s, N).attempt).toBe(4);

		s = apply(s, qa(N, true));
		expect(s.clearing).toBeNull();
		expect(s.queue.indexOf(N)).toBe(ERROR_LAG);
		expect(cardOf(s, N)).toMatchObject({ count: 0, attempt: 5 });

		for (let i = 1; i <= CRITERION_FIRST; i++) {
			s = drainTo(s);
			expect(currentItem(s)?.firstAttempt).toBe(true);
			s = apply(s, qa(N, true));
			expect(cardOf(s, N).count).toBe(i);
			if (i < CRITERION_FIRST) expect(s.queue.indexOf(N)).toBe(LAGS[i - 1]);
		}

		expect(cardOf(s, N)).toMatchObject({ done: true, failed: true, attempt: 5 + CRITERION_FIRST });
		expect(s.queue).not.toContain(N);
		expect(() => SessionSnapshotSchema.parse(s)).not.toThrow();
	});
});
