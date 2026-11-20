import { describe, expect, it } from 'vitest';
import type { CardCaches } from '#lib/db/schemas/card.ts';
import type { ExerciseKind, SessionId } from '#lib/db/schemas/common.ts';
import type { ReviewEvent, StudyEvent } from '#lib/db/schemas/event.ts';
import { criterionHistory, hasMetCriterion } from '#lib/engine/criterion-history.ts';
import { weightOf } from '#lib/engine/exercise-kinds.ts';
import { DEFAULT_FSRS_CONFIG, reviewFsrs } from '#lib/engine/fsrs.ts';
import { DEFAULT_REPLAY_CONFIG, replay } from '#lib/engine/replay.ts';
import { MS_PER_DAY } from '#lib/engine/time.ts';
import { cardId, eventId, makeReview, uuid } from './fixtures.ts';

/**
 * Phase 8.6 replay rules: a hinted review never counts toward the criterion and is rated Hard for
 * FSRS when it is a correct first attempt; practice events are skipped entirely; matching is
 * recognition while pretest and hotspot stay none.
 *
 * @see BUILD_PLAN §6.2, §6.3; SESSION_NOTES J; Decisions log "Phase 8.6 Q4" and "Q5"
 */

const CARD = cardId(1);
const S1 = uuid(0x5e1) as SessionId;
const S2 = uuid(0x5e2) as SessionId;
const DAY0 = Date.UTC(2026, 8, 1, 12);

let seq = 0;
const ev = (overrides: Partial<ReviewEvent> = {}): ReviewEvent => {
	seq += 1;
	return makeReview({
		id: eventId(0x2000 + seq),
		seq,
		ts: DAY0 + seq * 30_000,
		cardId: CARD,
		sessionId: S1,
		mode: 'longterm',
		credited: true,
		...overrides
	});
};

const caches = (
	events: readonly StudyEvent[],
	path: ExerciseKind[] = ['mc', 'cloze']
): CardCaches => {
	const result = replay(events, [{ id: CARD, path }], DEFAULT_REPLAY_CONFIG).result[CARD];
	if (!result) throw new Error('no caches');
	return result;
};

describe('weightOf (Phase 8.6 Q5)', () => {
	it('gives matching the recognition weight', () => {
		expect(weightOf('matching')).toBe('recognition');
	});
	it('keeps pretest and hotspot at none', () => {
		expect(weightOf('pretest')).toBe('none');
		expect(weightOf('hotspot')).toBe('none');
	});
	it('keeps the other warm-up neighbours unchanged (recall full, choose recognition)', () => {
		expect(weightOf('cloze')).toBe('full');
		expect(weightOf('mc')).toBe('recognition');
		expect(weightOf('ideaUnit')).toBe('full');
		expect(weightOf('listPick')).toBe('recognition');
	});
});

describe('a hinted answer and the criterion', () => {
	const session = (events: StudyEvent[]) => criterionHistory(events).sessions.get(S1);

	it('never counts toward the criterion, even a correct full-weight first attempt', () => {
		const history = [ev({ hinted: true, required: 1 })];
		expect(session(history)?.criterion.count ?? 0).toBe(0);
		expect(hasMetCriterion(history)).toBe(false);
	});

	it('never counts as recognition either', () => {
		const events = [ev({ hinted: true, weight: 'recognition', kind: 'mc', required: 1 })];
		expect(session(events)?.criterion.count ?? 0).toBe(0);
	});

	it('an unhinted full correct meets a required-1 criterion where the hinted one did not', () => {
		expect(hasMetCriterion([ev({ required: 1 })])).toBe(true);
		expect(hasMetCriterion([ev({ required: 1, hinted: true })])).toBe(false);
	});

	it('leaves the count unchanged: counting corrects around a hinted one still need the full count', () => {
		const events = [ev({ required: 2 }), ev({ required: 2, hinted: true }), ev({ required: 2 })];
		expect(session(events)?.criterion.count).toBe(2);
		expect(hasMetCriterion(events)).toBe(true);
		const withoutLast = events.slice(0, 2);
		expect(hasMetCriterion(withoutLast)).toBe(false);
	});

	it('does not reset the count when a hinted answer is wrong (SPEC-GAP: hinted wrong answers)', () => {
		// SPEC-GAP: a hinted wrong is not stated. Reading: a hint never counts, so it neither adds
		// nor resets.
		const events = [ev({ required: 2 }), ev({ required: 2, hinted: true, correct: false })];
		expect(session(events)?.criterion.count).toBe(1);
	});

	it('a hinted correct answer does not make the card daysCorrect', () => {
		expect(caches([ev({ hinted: true, required: 1 })]).daysCorrect).toBe(0);
		expect(caches([ev({ required: 1 })]).daysCorrect).toBe(1);
	});
});

describe('a hinted correct first attempt is rated Hard for FSRS', () => {
	const hard = reviewFsrs(null, DAY0 + 30_000, 'hard', DEFAULT_FSRS_CONFIG).result;
	const good = reviewFsrs(null, DAY0 + 30_000, 'good', DEFAULT_FSRS_CONFIG).result;

	function first(overrides: Partial<ReviewEvent>): ReviewEvent {
		return makeReview({
			id: eventId(0x3001),
			seq: 1,
			ts: DAY0 + 30_000,
			cardId: CARD,
			sessionId: S1,
			mode: 'longterm',
			credited: true,
			...overrides
		});
	}

	it('sanity: Hard and Good give different stability', () => {
		expect(hard.stability).toBeLessThan(good.stability);
	});

	it('uses Hard instead of Good for a full-weight hinted correct', () => {
		const result = caches([first({ hinted: true })]);
		expect(result.fsrs).not.toBeNull();
		expect(result.fsrs?.stability).toBe(hard.stability);
	});

	it('uses Hard for a recognition-weight hinted correct too', () => {
		const result = caches([first({ hinted: true, weight: 'recognition', kind: 'mc' })]);
		expect(result.fsrs?.stability).toBe(hard.stability);
	});

	it('leaves an unhinted full-weight correct at Good', () => {
		expect(caches([first({})]).fsrs?.stability).toBe(good.stability);
	});

	it('still rates a hinted wrong first attempt Again, as any wrong answer', () => {
		const again = reviewFsrs(null, DAY0 + 30_000, 'again', DEFAULT_FSRS_CONFIG).result;
		// SPEC-GAP: hinted wrong is not stated; reading: wrong is Again whether hinted or not.
		expect(caches([first({ hinted: true, correct: false })]).fsrs?.stability).toBe(again.stability);
	});

	it('does not review FSRS again for a later unhinted attempt in the same session', () => {
		// SPEC-GAP: reading - "the session's first attempt" is the card's first event in the session,
		// so one FSRS review (Hard) happens per session even if the hinted event does not count.
		const events = [
			first({ hinted: true }),
			ev({ sessionId: S1, ts: DAY0 + 60_000, seq: 2, id: eventId(0x3002) })
		];
		expect(caches(events).fsrs?.stability).toBe(hard.stability);
	});

	it('does not touch FSRS for a hinted correct that is not a first attempt', () => {
		expect(caches([first({ hinted: true, firstAttempt: false })]).fsrs).toBeNull();
	});

	it('reviews FSRS in a later session again, as usual', () => {
		const events = [
			first({ hinted: true }),
			ev({ sessionId: S2, ts: DAY0 + 3 * MS_PER_DAY, seq: 2, id: eventId(0x3002) })
		];
		expect(caches(events).fsrs?.stability).not.toBe(hard.stability);
	});
});

describe('practice events are skipped entirely by replay', () => {
	const real = (): StudyEvent[] => [
		ev({ sessionId: S1, required: 1, ts: DAY0 + 1_000, seq: 1, id: eventId(0x4001) }),
		ev({ sessionId: S2, required: 1, ts: DAY0 + 2 * MS_PER_DAY, seq: 2, id: eventId(0x4002) })
	];
	const practice = (over: Partial<ReviewEvent> = {}): ReviewEvent =>
		ev({ mode: 'practice', credited: false, sessionId: uuid(0x5e9) as SessionId, ...over });

	it('leaves a card with only practice events exactly as a card with no events', () => {
		const events = [
			practice(),
			practice({ correct: false }),
			practice({ kind: 'mc', weight: 'recognition' })
		];
		expect(caches(events)).toEqual(caches([]));
	});

	it('gives an untouched card: no FSRS, no study day, no accuracy, pathStep 0, unseen', () => {
		const result = caches([practice(), practice()]);
		expect(result.fsrs).toBeNull();
		expect(result.daysCorrect).toBe(0);
		expect(result.accuracy).toEqual({ n: 0, correct: 0 });
		expect(result.pathStep).toBe(0);
		expect(result.status).toBe('unseen');
	});

	it('does not move pathStep or accuracy even for correct first attempts of the path kind', () => {
		const result = caches([practice({ kind: 'mc' }), practice({ kind: 'cloze' })]);
		expect(result.pathStep).toBe(0);
		expect(result.accuracy.n).toBe(0);
	});

	it('is not an acquisition handoff when the practice event says so', () => {
		const result = caches([practice({ ts: DAY0, credited: true })]);
		expect(result.fsrs).toBeNull();
		expect(result.due).toEqual(caches([]).due);
	});

	it('skips practice events even when marked credited', () => {
		expect(caches([practice({ credited: true, required: 1 })])).toEqual(caches([]));
	});

	it('leaves the caches of real reviews unchanged when practice events are mixed in', () => {
		const base = caches(real());
		const mixed = caches([
			practice({ ts: DAY0 + 500, seq: 10, id: eventId(0x4010) }),
			...real(),
			practice({ correct: false, ts: DAY0 + 2 * MS_PER_DAY + 500, seq: 11, id: eventId(0x4011) }),
			practice({ ts: DAY0 + 5 * MS_PER_DAY, seq: 12, id: eventId(0x4012) })
		]);
		expect(mixed).toEqual(base);
	});

	it('does not make a later first real attempt look like a second one (known on first try, criterion)', () => {
		const history = criterionHistory([practice(), ev()]);
		// SPEC-GAP: reading - criterion-history also ignores practice events, so the practice answer
		// is not the card's "very first attempt ever".
		expect(history.attempted).toBe(true);
		expect(criterionHistory([practice()]).attempted).toBe(false);
		expect(criterionHistory([practice()]).knownOnFirstTry).toBe(false);
	});
});
