import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DAY_ROLLOVER_HOUR } from '#lib/config/defaults.ts';
import type { CardCaches } from '#lib/db/schemas/card.ts';
import type { Mode, SessionId } from '#lib/db/schemas/common.ts';
import type { StudyEvent } from '#lib/db/schemas/event.ts';
import { DEFAULT_REPLAY_CONFIG, replay, type ReplayConfig } from '#lib/engine/replay.ts';
import { dayIndex, MS_PER_DAY, MS_PER_MINUTE } from '#lib/engine/time.ts';
import { cardId, DEVICE_A, eventId, makeReview, NUM_RUNS, uuid } from './fixtures.ts';

/**
 * Each event's own time zone (BUILD_PLAN §6.12 "Event time zone", DATA_MODEL §3.6 `tzOffsetMin`,
 * Decisions log "Fix pass (A10)"): replay puts an event on `dayIndex(ts, event.tzOffsetMin)`, and on
 * the replay config's offset when the event has none.
 */

const RUNS = { numRuns: NUM_RUNS };
const CARD = cardId(1);
const ANSWER_GAP_MS = 30_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
/** Tue 1 Sep 2026, 00:00 UTC. */
const DAY0 = Date.UTC(2026, 8, 1);
/** UTC+2 and UTC−5, in minutes east of UTC. */
const TZ_EAST = 120;
const TZ_WEST = -300;
const config = (tzOffsetMin: number): ReplayConfig => ({ ...DEFAULT_REPLAY_CONFIG, tzOffsetMin });
const UTC = config(0);
const EAST = config(TZ_EAST);

/** UTC wall-clock time on calendar day `day` after DAY0. */
const at = (day: number, hour: number): number => DAY0 + day * MS_PER_DAY + hour * MS_PER_HOUR;

/** One hour before the UTC rollover on day 1: study day 0 in UTC, study day 1 in UTC+2. */
const BEFORE_UTC_ROLLOVER = at(1, DAY_ROLLOVER_HOUR - 1);

type Tz = { tzOffsetMin?: number };

/** A one-device history with unique ids and a rising seq. */
function history() {
	const events: StudyEvent[] = [];
	let n = 0;
	function session(mode: Mode, start: number, count: number, tz: Tz) {
		const sessionId = uuid(0x5e000 + start / ANSWER_GAP_MS) as SessionId;
		for (let i = 0; i < count; i += 1) {
			n += 1;
			events.push(
				makeReview({
					id: eventId(0x1000 + n),
					seq: n,
					deviceId: DEVICE_A,
					cardId: CARD,
					sessionId,
					ts: start + i * ANSWER_GAP_MS,
					mode,
					credited: mode !== 'acquisition',
					correct: true,
					...tz
				})
			);
		}
	}
	return { events, session };
}

function cachesOf(events: readonly StudyEvent[], cfg: ReplayConfig): CardCaches {
	const caches = replay(events, [{ id: CARD, path: ['cloze'] }], cfg).result[CARD];
	if (!caches) throw new Error('replay returned no caches for the requested card');
	return caches;
}

/** Three correct longterm answers on day 0 at noon UTC, then one at `secondTs`. */
function twoSessions(first: Tz, second: Tz, secondTs = BEFORE_UTC_ROLLOVER): StudyEvent[] {
	const h = history();
	h.session('longterm', at(0, 12), 3, first);
	h.session('longterm', secondTs, 1, second);
	return h.events;
}

describe('replay: each event counts its study day in its own tzOffsetMin', () => {
	it('sanity: the second session is day 0 in UTC and day 1 in UTC+2', () => {
		expect(dayIndex(BEFORE_UTC_ROLLOVER, 0)).toBe(dayIndex(at(0, 12), 0));
		expect(dayIndex(BEFORE_UTC_ROLLOVER, TZ_EAST)).toBe(dayIndex(at(0, 12), TZ_EAST) + 1);
	});

	it("uses the event's offset over the config offset", () => {
		const east = { tzOffsetMin: TZ_EAST };
		expect(cachesOf(twoSessions(east, east), UTC).daysCorrect).toBe(2);
	});

	it('respects an event offset of 0 rather than treating it as absent', () => {
		const utc = { tzOffsetMin: 0 };
		expect(cachesOf(twoSessions(utc, utc), EAST).daysCorrect).toBe(1);
	});

	it('falls back to the config offset for events without tzOffsetMin', () => {
		const events = twoSessions({}, {});
		expect(cachesOf(events, UTC).daysCorrect).toBe(1);
		expect(cachesOf(events, EAST).daysCorrect).toBe(2);
	});

	it('mixes old events (config offset) with new ones (own offset)', () => {
		// Old day-0 answers have no offset; the new answer carries UTC+2 and lands on day 1.
		expect(cachesOf(twoSessions({}, { tzOffsetMin: TZ_EAST }), UTC).daysCorrect).toBe(2);
	});

	it('keeps past study days put after travel: each event in the zone it was logged in', () => {
		// Day 0 at 14:00 in UTC+2, then 22:00 the same local evening after flying to UTC−5.
		const events = twoSessions(
			{ tzOffsetMin: TZ_EAST },
			{ tzOffsetMin: TZ_WEST },
			BEFORE_UTC_ROLLOVER
		);
		expect(dayIndex(BEFORE_UTC_ROLLOVER, TZ_WEST)).toBe(dayIndex(at(0, 12), TZ_EAST));
		// With every event in UTC+2 (the old reading) these would be two study days.
		expect(cachesOf(events, EAST).daysCorrect).toBe(1);
	});

	it('gives the same caches whatever the config offset when every event has its own', () => {
		const events = twoSessions({ tzOffsetMin: TZ_EAST }, { tzOffsetMin: TZ_EAST });
		const expected = cachesOf(events, UTC);
		fc.assert(
			fc.property(fc.integer({ min: -840, max: 840 }), (tz) => {
				expect(cachesOf(events, config(tz))).toStrictEqual(expected);
			}),
			RUNS
		);
	});
});

describe('replay: acquisition handoff due uses the event offset for its study day', () => {
	// SPEC-GAP: the handoff `due` is "the start of the study day after its last acquisition review".
	// The study day comes from the event's offset; is that next day's start computed in the event's
	// offset or the config's? Only the study day (as seen in UTC+2) is asserted, which both agree on.
	it('is due on the study day after the event-zone study day of the last acquisition review', () => {
		const h = history();
		h.session('acquisition', BEFORE_UTC_ROLLOVER, 3, { tzOffsetMin: TZ_EAST });
		const { due, fsrs } = cachesOf(h.events, UTC);
		expect(fsrs).toBeNull();
		expect(due).toBeDefined();
		// In UTC the review is study day 0 (due day 1); in its own UTC+2 it is study day 1 (due day 2).
		expect(dayIndex(due!, TZ_EAST)).toBe(dayIndex(BEFORE_UTC_ROLLOVER, TZ_EAST) + 1);
		expect(due!).toBeGreaterThan(at(1, DAY_ROLLOVER_HOUR));
	});
});
