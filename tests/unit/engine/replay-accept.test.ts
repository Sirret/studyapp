import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { StudyEvent } from '#lib/db/schemas/event.ts';
import { replay } from '#lib/engine/replay.ts';
import {
	arbShuffled,
	cardId,
	eventId,
	makeAcceptAdded,
	makeReview,
	NUM_RUNS,
	replayCards,
	T1,
	T2
} from './fixtures.ts';

/**
 * Decisions log, "Phase 5: 'I was right'": replay treats a review event as correct when an
 * `acceptAdded` names it in `reviewEventId`, whatever order they arrive in; an `acceptAdded`
 * without `reviewEventId` changes nothing.
 */

const RUNS = { numRuns: NUM_RUNS };
const CARD_A = cardId(1);
const CARD_B = cardId(2);
const REVIEW_ID = eventId(10);
const ACCEPT_ID = eventId(20);

const wrong = makeReview({ id: REVIEW_ID, ts: T1, seq: 1, cardId: CARD_A, correct: false });
const rightAnswer = { ...wrong, correct: true };

const replayed = (events: readonly StudyEvent[], ...cards: (typeof CARD_A)[]) =>
	replay(events, replayCards(...(cards.length > 0 ? cards : [CARD_A]))).result;
const acceptFor = (overrides: Parameters<typeof makeAcceptAdded>[0] = {}) =>
	makeAcceptAdded({ id: ACCEPT_ID, ts: T2, seq: 2, value: 'tcp/ip', ...overrides });

describe('replay: acceptAdded re-judges a review', () => {
	it('treats a wrong review as correct when an acceptAdded names it in reviewEventId', () => {
		const events = [wrong, acceptFor({ reviewEventId: REVIEW_ID })];
		expect(replayed(events)[CARD_A]?.accuracy).toStrictEqual({ n: 1, correct: 1 });
	});

	it('gives exactly the caches the same review logged as correct would give', () => {
		const events = [wrong, acceptFor({ reviewEventId: REVIEW_ID })];
		expect(replayed(events)).toStrictEqual(replayed([rightAnswer]));
	});

	it('re-judges even when the acceptAdded sorts before the review', () => {
		const events = [wrong, acceptFor({ ts: T1 - 1, reviewEventId: REVIEW_ID })];
		expect(replayed(events)).toStrictEqual(replayed([rightAnswer]));
	});

	it('gives the same caches whatever order the events arrive in', () => {
		const later = makeReview({
			id: eventId(11),
			ts: T2 + 1,
			seq: 3,
			cardId: CARD_A,
			correct: true
		});
		const events = [wrong, acceptFor({ reviewEventId: REVIEW_ID }), later];
		const expected = replayed([rightAnswer, later]);
		fc.assert(
			fc.property(arbShuffled(events), (shuffled) => {
				expect(replayed(shuffled)).toStrictEqual(expected);
			}),
			RUNS
		);
	});

	it('changes nothing when the acceptAdded has no reviewEventId', () => {
		const events = [wrong, acceptFor()];
		expect(replayed(events)).toStrictEqual(replayed([wrong]));
		expect(replayed(events)[CARD_A]?.accuracy).toStrictEqual({ n: 1, correct: 0 });
	});

	it('changes nothing when reviewEventId names no event', () => {
		const events = [wrong, acceptFor({ reviewEventId: eventId(99) })];
		expect(replayed(events)).toStrictEqual(replayed([wrong]));
	});

	it('re-judges only the review it names', () => {
		const second = makeReview({
			id: eventId(11),
			ts: T2 + 1,
			seq: 3,
			cardId: CARD_A,
			correct: false
		});
		const events = [wrong, second, acceptFor({ ts: T2 + 2, seq: 4, reviewEventId: eventId(11) })];
		expect(replayed(events)[CARD_A]?.accuracy).toStrictEqual({ n: 2, correct: 1 });
		expect(replayed(events)).toStrictEqual(replayed([wrong, { ...second, correct: true }]));
	});

	it('leaves an already-correct review correct', () => {
		const events = [rightAnswer, acceptFor({ reviewEventId: REVIEW_ID })];
		expect(replayed(events)).toStrictEqual(replayed([rightAnswer]));
	});

	it('finds the review on whichever card it belongs to, and leaves other cards alone', () => {
		const onB = makeReview({ id: eventId(12), ts: T1, seq: 5, cardId: CARD_B, correct: false });
		const events = [wrong, onB, acceptFor({ reviewEventId: eventId(12) })];
		const result = replayed(events, CARD_A, CARD_B);
		expect(result[CARD_B]?.accuracy).toStrictEqual({ n: 1, correct: 1 });
		expect(result[CARD_A]?.accuracy).toStrictEqual({ n: 1, correct: 0 });
		expect(result).toStrictEqual(replayed([wrong, { ...onB, correct: true }], CARD_A, CARD_B));
	});
});
