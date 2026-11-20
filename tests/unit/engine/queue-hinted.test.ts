import { describe, expect, it } from 'vitest';
import { CRITERION_FIRST, LAGS } from '#lib/config/defaults.ts';
import type { SessionSnapshot } from '#lib/db/schemas/session.ts';
import { applyAnswer, type QueueAnswer } from '#lib/engine/queue.ts';
import { cardId } from './fixtures.ts';
import { at, cardOf, cardRange, makeSnapshot, qa } from './session-fixtures.ts';

const N = cardId(1);
const OTHERS = cardRange(100, at(LAGS, LAGS.length - 1) + 10);
const apply = (state: SessionSnapshot, answer: QueueAnswer) => applyAnswer(state, answer).result;
const hinted = (correct: boolean): QueueAnswer => ({ ...qa(N, correct), hinted: true });

function queueWith(extra = {}): SessionSnapshot {
	return makeSnapshot([N, ...OTHERS], {
		[N]: { phase: 'new', required: CRITERION_FIRST, ...extra }
	});
}

/** @see BUILD_PLAN §6.3 (a hinted answer never counts); Decisions log "Phase 8.6 Q10" */
describe('applyAnswer: hinted answers', () => {
	it('a hinted correct does not add to the count and the card stays in the queue', () => {
		const next = apply(queueWith({ count: 1 }), hinted(true));
		expect(cardOf(next, N).count).toBe(1);
		expect(cardOf(next, N).done).toBe(false);
		expect(next.queue).toContain(N);
	});

	it('a hinted correct does not finish a card one correct short of its criterion', () => {
		const next = apply(queueWith({ count: CRITERION_FIRST - 1 }), hinted(true));
		expect(cardOf(next, N).done).toBe(false);
		expect(cardOf(next, N).count).toBe(CRITERION_FIRST - 1);
	});

	it('a hinted correct does not reset the count', () => {
		const next = apply(queueWith({ count: 2 }), hinted(true));
		expect(cardOf(next, N).count).toBe(2);
	});

	it('a hinted first-ever correct does not lower `required`', () => {
		const next = apply(queueWith({ firstEver: true }), hinted(true));
		expect(cardOf(next, N).required).toBe(CRITERION_FIRST);
		expect(cardOf(next, N).firstEver).toBe(false);
	});

	it('a hinted wrong answer still sends the card to clearing', () => {
		const next = apply(queueWith(), hinted(false));
		expect(next.clearing).toBe(N);
		expect(next.queue[0]).toBe(N);
	});

	it('the same correct without a hint counts', () => {
		const next = apply(queueWith({ count: 1 }), qa(N, true));
		expect(cardOf(next, N).count).toBe(2);
	});
});
