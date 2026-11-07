import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EMPTY_CARD_CACHES } from '#lib/db/schemas/card.ts';
import type { StudyEvent } from '#lib/db/schemas/event.ts';
import { compareEvents, replay } from '#lib/engine/replay.ts';
import type { EventOrderKey } from '#lib/engine/replay.ts';
import {
	arbEvents,
	arbShuffled,
	CARD_POOL,
	cardId,
	deepFreeze,
	DEVICE_A,
	DEVICE_B,
	eventId,
	makeAcceptAdded,
	makePretest,
	makeReview,
	makeSelfRated,
	NUM_RUNS,
	T1,
	T2
} from './fixtures.ts';

const RUNS = { numRuns: NUM_RUNS };
const CARD_A = cardId(1);
const CARD_B = cardId(2);
const CARD_C = cardId(3);

/** The sign of a comparison, with -0 folded to 0 and NaN left to fail the assertion. */
const sign = (n: number): number => Math.sign(n) + 0;
const key = (ts: number, deviceId: typeof DEVICE_A, seq: number): EventOrderKey => ({
	ts,
	deviceId,
	seq
});

function expectBefore(earlier: EventOrderKey, later: EventOrderKey): void {
	expect(sign(compareEvents(earlier, later))).toBe(-1);
	expect(sign(compareEvents(later, earlier))).toBe(1);
}

const accuracyOf = (events: readonly StudyEvent[], card = CARD_A) =>
	replay(events, [card]).result[card]?.accuracy;

describe('compareEvents', () => {
	it('orders by ts first, over deviceId and seq', () => {
		expectBefore(key(T1, DEVICE_B, 9), key(T2, DEVICE_A, 1));
	});

	it('does not round close timestamps together', () => {
		expectBefore(key(1.25, DEVICE_B, 2), key(1.75, DEVICE_A, 1));
	});

	it('orders by deviceId on a ts tie, over seq', () => {
		expectBefore(key(T1, DEVICE_A, 9), key(T1, DEVICE_B, 1));
	});

	it('orders by seq on a ts and deviceId tie, as a number', () => {
		expectBefore(key(T1, DEVICE_A, 9), key(T1, DEVICE_A, 10));
	});

	it('returns 0 when all three fields tie', () => {
		expect(sign(compareEvents(key(T1, DEVICE_A, 1), key(T1, DEVICE_A, 1)))).toBe(0);
	});

	// SPEC-GAP: is deviceId compared by code unit? BUILD_PLAN says "the one order replay uses on every
	// device"; `localeCompare` would make mixed-case ids depend on the device's locale.
	it('compares deviceId by code unit, so the order is the same under every locale', () => {
		const upper = 'B0000000-0000-4000-8000-000000000000' as typeof DEVICE_A;
		const lower = 'a0000000-0000-4000-8000-000000000000' as typeof DEVICE_A;
		expectBefore(key(T1, upper, 1), key(T1, lower, 1));
	});

	it('is a consistent total order on any keys', () => {
		const arbKey = fc.record({
			ts: fc.constantFrom(T1, T2),
			deviceId: fc.constantFrom(DEVICE_A, DEVICE_B),
			seq: fc.constantFrom(1, 2, 10)
		});
		fc.assert(
			fc.property(arbKey, arbKey, arbKey, (a, b, c) => {
				expect(sign(compareEvents(a, b))).toBe(-sign(compareEvents(b, a)) + 0);
				expect(sign(compareEvents(a, a))).toBe(0);
				if (compareEvents(a, b) <= 0 && compareEvents(b, c) <= 0) {
					expect(compareEvents(a, c)).toBeLessThanOrEqual(0);
				}
			}),
			RUNS
		);
	});
});

describe('replay: cards and scope', () => {
	it('gives a card with no events EMPTY_CARD_CACHES', () => {
		expect(replay([], [CARD_A]).result).toStrictEqual({ [CARD_A]: EMPTY_CARD_CACHES });
	});

	it('returns nothing for no cards, even with events', () => {
		expect(replay([makeReview()], []).result).toStrictEqual({});
	});

	it('returns exactly the requested cards', () => {
		const { result } = replay([makeReview({ cardId: CARD_A })], [CARD_A, CARD_B]);
		expect(Object.keys(result).sort()).toStrictEqual([CARD_A, CARD_B]);
	});

	it('ignores an event for a card not in cardIds', () => {
		const stray = makeReview({ id: eventId(2), cardId: CARD_B });
		expect(replay([stray], [CARD_A]).result).toStrictEqual({ [CARD_A]: EMPTY_CARD_CACHES });
	});

	it('does not leak one card events into another', () => {
		const events = [
			makeReview({ id: eventId(1), cardId: CARD_A, correct: true }),
			makeReview({ id: eventId(2), cardId: CARD_A, correct: false }),
			makeReview({ id: eventId(3), cardId: CARD_B, correct: true })
		];
		const { result } = replay(events, [CARD_A, CARD_B, CARD_C]);
		expect(result[CARD_A]?.accuracy).toStrictEqual({ n: 2, correct: 1 });
		expect(result[CARD_B]?.accuracy).toStrictEqual({ n: 1, correct: 1 });
		expect(result[CARD_C]).toStrictEqual(EMPTY_CARD_CACHES);
	});

	it('does not count a card twice when its id is requested twice', () => {
		const { result } = replay([makeReview()], [CARD_A, CARD_A]);
		expect(Object.keys(result)).toStrictEqual([CARD_A]);
		expect(result[CARD_A]?.accuracy).toStrictEqual({ n: 1, correct: 1 });
	});
});

describe('replay: accuracy', () => {
	it('starts at n 0, correct 0 with no events', () => {
		expect(accuracyOf([])).toStrictEqual({ n: 0, correct: 0 });
	});

	it('counts a correct first-attempt review in n and correct', () => {
		expect(accuracyOf([makeReview()])).toStrictEqual({ n: 1, correct: 1 });
	});

	it('counts a wrong first-attempt review in n only', () => {
		expect(accuracyOf([makeReview({ correct: false })])).toStrictEqual({ n: 1, correct: 0 });
	});

	it('counts weight full and weight recognition', () => {
		const events = [
			makeReview({ id: eventId(1), weight: 'full' }),
			makeReview({ id: eventId(2), weight: 'recognition' })
		];
		expect(accuracyOf(events)).toStrictEqual({ n: 2, correct: 2 });
	});

	it('does not count weight none', () => {
		expect(accuracyOf([makeReview({ weight: 'none' })])).toStrictEqual({ n: 0, correct: 0 });
	});

	it('does not count a later attempt', () => {
		expect(accuracyOf([makeReview({ firstAttempt: false })])).toStrictEqual({ n: 0, correct: 0 });
	});

	it('does not count pretest or selfRated events', () => {
		const events = [
			makePretest({ id: eventId(1), cardId: CARD_A }),
			makeSelfRated({ id: eventId(2), cardId: CARD_A, rating: 'good' }),
			makeAcceptAdded({ id: eventId(3) })
		];
		expect(accuracyOf(events)).toStrictEqual({ n: 0, correct: 0 });
	});

	// SPEC-GAP: does `credited: false` remove a review from accuracy? The filter stated for accuracy
	// names only type, firstAttempt and weight, so `credited` is read as not gating it. Likewise mode.
	it('does not filter on credited or mode', () => {
		const events = [
			makeReview({ id: eventId(1), credited: false }),
			makeReview({ id: eventId(2), mode: 'cram' })
		];
		expect(accuracyOf(events)).toStrictEqual({ n: 2, correct: 2 });
	});

	it('matches its definition on any events', () => {
		fc.assert(
			fc.property(arbEvents, (events) => {
				const { result } = replay(events, CARD_POOL);
				for (const card of CARD_POOL) {
					const counted = events.filter(
						(event) =>
							event.type === 'review' &&
							event.cardId === card &&
							event.firstAttempt &&
							event.weight !== 'none'
					);
					const correct = counted.filter((event) => event.type === 'review' && event.correct);
					expect(result[card]?.accuracy).toStrictEqual({
						n: counted.length,
						correct: correct.length
					});
				}
			}),
			RUNS
		);
	});
});

describe('replay: purity and determinism', () => {
	const events = [
		makeReview({ id: eventId(2), ts: T2, cardId: CARD_A }),
		makeReview({ id: eventId(1), ts: T1, cardId: CARD_B, correct: false })
	];

	it('does not mutate its inputs', () => {
		const cards = [CARD_B, CARD_A];
		expect(() => replay(deepFreeze([...events]), deepFreeze(cards))).not.toThrow();
		expect(cards).toStrictEqual([CARD_B, CARD_A]);
	});

	it('does not write its counts into EMPTY_CARD_CACHES', () => {
		const before = structuredClone(EMPTY_CARD_CACHES);
		const { result } = replay(events, [CARD_A, CARD_B, CARD_C]);
		expect(EMPTY_CARD_CACHES).toStrictEqual(before);
		expect(result[CARD_C]).toStrictEqual(EMPTY_CARD_CACHES);
	});

	// SPEC-GAP: trace contents are unspecified. Only the `TraceEntry` shape and "a decision was traced"
	// are asserted (CLAUDE.md rule 17).
	it('traces its work as entries with a rule', () => {
		const { trace } = replay(events, [CARD_A]);
		expect(trace.length).toBeGreaterThan(0);
		for (const entry of trace) expect(entry.rule).toEqual(expect.any(String));
	});

	it('returns an identical result and trace on a second call', () => {
		fc.assert(
			fc.property(arbEvents, (generated) => {
				expect(replay(generated, CARD_POOL)).toStrictEqual(replay(generated, CARD_POOL));
			}),
			RUNS
		);
	});

	// SPEC-GAP: which order do two distinct events with the same `(ts, deviceId, seq)` replay in? The
	// generator produces such ties; only the result being independent of input order is asserted.
	it('gives an identical result and trace whatever order the events arrive in', () => {
		const arb = arbEvents.chain((generated) =>
			fc.tuple(fc.constant(generated), arbShuffled(generated))
		);
		fc.assert(
			fc.property(arb, ([generated, shuffled]) => {
				expect(replay(shuffled, CARD_POOL)).toStrictEqual(replay(generated, CARD_POOL));
			}),
			RUNS
		);
	});

	// SPEC-GAP: does "independent of input order" cover `cardIds` too, including the trace? Read as yes.
	it('gives an identical result and trace whatever order the cards are listed in', () => {
		const arb = arbEvents.chain((generated) =>
			fc.tuple(fc.constant(generated), arbShuffled(CARD_POOL))
		);
		fc.assert(
			fc.property(arb, ([generated, cards]) => {
				expect(replay(generated, cards)).toStrictEqual(replay(generated, CARD_POOL));
			}),
			RUNS
		);
	});
});
