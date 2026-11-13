import { describe, expect, it } from 'vitest';
import { IDLE_CAP_SEC } from '#lib/config/defaults.ts';
import type { SessionId } from '#lib/db/schemas/common.ts';
import { dayIndex } from '#lib/engine/time.ts';
import { studyMinutesOn } from '#lib/engine/study-time.ts';
import {
	eventId,
	makeAcceptAdded,
	makePretest,
	makeReview,
	makeSelfRated,
	SESSION,
	uuid
} from './fixtures.ts';

/**
 * Today's minutes used = session wall time with idle gaps capped (SESSION_NOTES A3).
 *
 * @see BUILD_PLAN §6.9 ("Today's minutes") and Decisions log (Fix pass: wall-time minutes)
 */

const SEC = 1_000;
const MIN = 60 * SEC;
const CAP = IDLE_CAP_SEC * SEC;
/** Noon on some day, UTC. */
const NOON = 20_000 * 24 * 60 * MIN + 12 * 60 * MIN;
const TODAY = dayIndex(NOON, 0);
const OTHER = uuid(0x5f) as SessionId;

let n = 0;
const at = (ts: number, responseMs = 5 * SEC, sessionId = SESSION) =>
	makeReview({ id: eventId(++n), ts, responseMs, sessionId, seq: n });
const minutes = (events: Parameters<typeof studyMinutesOn>[0]) =>
	studyMinutesOn(events, TODAY, 0).result;

describe('studyMinutesOn', () => {
	it('counts a session from its first answer time to its last answer', () => {
		const events = [at(NOON, 10 * SEC), at(NOON + 20 * SEC), at(NOON + 50 * SEC)];
		// 10 s for the first answer, then the 20 s and 30 s gaps between answers.
		expect(minutes(events)).toBeCloseTo(60 / 60, 9);
	});

	it('caps every gap between two answers at IDLE_CAP_SEC', () => {
		const events = [at(NOON, 10 * SEC), at(NOON + 30 * MIN)];
		expect(minutes(events)).toBeCloseTo((10 * SEC + CAP) / MIN, 9);
	});

	it("caps the first answer's response time at IDLE_CAP_SEC too", () => {
		expect(minutes([at(NOON, 20 * MIN)])).toBeCloseTo(CAP / MIN, 9);
	});

	it('counts reading and thinking time between answers, not only response times', () => {
		const events = [at(NOON, 2 * SEC), at(NOON + 40 * SEC, 2 * SEC)];
		const responseOnly = (2 * SEC + 2 * SEC) / MIN;
		expect(minutes(events)).toBeGreaterThan(responseOnly);
		expect(minutes(events)).toBeCloseTo((2 * SEC + 40 * SEC) / MIN, 9);
	});

	it('adds separate sessions, never counting the gap between them', () => {
		const events = [
			at(NOON, 10 * SEC),
			at(NOON + 10 * SEC, 10 * SEC),
			at(NOON + 2 * 60 * MIN, 10 * SEC, OTHER),
			at(NOON + 2 * 60 * MIN + 10 * SEC, 10 * SEC, OTHER)
		];
		expect(minutes(events)).toBeCloseTo(40 / 60, 9);
	});

	it('orders events by time, whatever order they arrive in', () => {
		const a = at(NOON, 10 * SEC);
		const b = at(NOON + 20 * SEC);
		expect(minutes([b, a])).toBe(minutes([a, b]));
	});

	it('counts pretests and self-rated answers as part of their session', () => {
		const events = [
			makePretest({ id: eventId(++n), ts: NOON, responseMs: 10 * SEC, sessionId: SESSION }),
			makeSelfRated({ id: eventId(++n), ts: NOON + 30 * SEC, sessionId: SESSION })
		];
		expect(minutes(events)).toBeCloseTo(40 / 60, 9);
	});

	it('ignores events with no session ("I was right" additions)', () => {
		const events = [at(NOON, 10 * SEC), makeAcceptAdded({ id: eventId(++n), ts: NOON + 5 * SEC })];
		expect(minutes(events)).toBeCloseTo(10 / 60, 9);
	});

	it('counts only events on the given study day', () => {
		const yesterday = NOON - 24 * 60 * MIN;
		const events = [at(yesterday, 30 * SEC), at(NOON, 10 * SEC)];
		expect(minutes(events)).toBeCloseTo(10 / 60, 9);
	});

	it('is 0 with no events', () => {
		expect(minutes([])).toBe(0);
	});

	it('traces the sessions it counted', () => {
		const { trace } = studyMinutesOn([at(NOON)], TODAY, 0);
		expect(trace).toContainEqual(expect.objectContaining({ rule: 'study-time', sessions: 1 }));
	});
});
