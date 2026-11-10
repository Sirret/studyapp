import { describe, expect, it } from 'vitest';
import { CRITERION_FIRST, DAY_ROLLOVER_HOUR } from '#lib/config/defaults.ts';
import type { CardCaches } from '#lib/db/schemas/card.ts';
import type { Mode, SessionId } from '#lib/db/schemas/common.ts';
import type { ReviewEvent, StudyEvent } from '#lib/db/schemas/event.ts';
import { DEFAULT_REPLAY_CONFIG, replay, type ReplayConfig } from '#lib/engine/replay.ts';
import { dayIndex, MS_PER_DAY, MS_PER_MINUTE, startOfStudyDay } from '#lib/engine/time.ts';
import { cardId, eventId, makePretest, makeReview, uuid } from './fixtures.ts';

/**
 * The acquisition handoff: replay gives a card with acquisition reviews and no FSRS state
 * `due` = the start of the study day after its last acquisition review, `fsrs` staying null.
 *
 * @see BUILD_PLAN §6.1, §6.5, §6.7 "Handoff in replay", Decisions log (Phase 7: the acquisition handoff; status)
 */

const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const CARD = cardId(1);
/** Tue 1 Sep 2026, 00:00 UTC. */
const DAY0 = Date.UTC(2026, 8, 1);
const at = (day: number, hour = 18, minute = 0) =>
	DAY0 + day * MS_PER_DAY + hour * MS_PER_HOUR + minute * MS_PER_MINUTE;
const TZ_EAST = 120;
const TZ_WEST = -300;
const config = (tzOffsetMin: number): ReplayConfig => ({ ...DEFAULT_REPLAY_CONFIG, tzOffsetMin });

/** A history of review sessions with unique ids and increasing seq. */
function history() {
	const events: StudyEvent[] = [];
	let n = 0;
	let sessions = 0;
	function session(mode: Mode, start: number, answers: readonly Partial<ReviewEvent>[]) {
		sessions += 1;
		const sessionId = uuid(0x5e000 + sessions) as SessionId;
		answers.forEach((answer, i) => {
			n += 1;
			events.push(
				makeReview({
					id: eventId(0x1000 + n),
					seq: n,
					ts: start + i * 30_000,
					cardId: CARD,
					sessionId,
					mode,
					credited: mode !== 'acquisition',
					...answer
				})
			);
		});
	}
	return { events, session };
}
const ok: Partial<ReviewEvent> = { correct: true };
const no: Partial<ReviewEvent> = { correct: false };
const caches = (events: readonly StudyEvent[], tz = 0): CardCaches => {
	const c = replay(events, [{ id: CARD, path: ['cloze'] }], config(tz)).result[CARD];
	if (!c) throw new Error('no caches');
	return c;
};

describe('startOfStudyDay', () => {
	for (const tz of [0, TZ_EAST, TZ_WEST]) {
		it(`is the first millisecond of the study day (offset ${tz})`, () => {
			const day = dayIndex(at(3), tz);
			const start = startOfStudyDay(day, tz);
			expect(dayIndex(start, tz)).toBe(day);
			expect(dayIndex(start - 1, tz)).toBe(day - 1);
		});
	}

	it('falls at DAY_ROLLOVER_HOUR local time', () => {
		const rollover = DAY0 + DAY_ROLLOVER_HOUR * MS_PER_HOUR;
		expect(startOfStudyDay(dayIndex(rollover, 0), 0)).toBe(rollover);
		expect(startOfStudyDay(dayIndex(rollover, 0), TZ_EAST)).toBe(
			rollover - TZ_EAST * MS_PER_MINUTE
		);
	});

	it('grows by one day per day', () => {
		expect(startOfStudyDay(101, 0) - startOfStudyDay(100, 0)).toBe(MS_PER_DAY);
	});
});

describe('replay: acquisition handoff', () => {
	it('sets due to the start of the next study day and keeps fsrs null', () => {
		const h = history();
		h.session('acquisition', at(0), [ok, no, ok]);
		const c = caches(h.events);
		expect(c.fsrs).toBeNull();
		expect(c.due).toBe(startOfStudyDay(dayIndex(at(0), 0) + 1, 0));
	});

	it('uses the last acquisition review when there are several days of them', () => {
		const h = history();
		h.session('acquisition', at(0), [ok]);
		h.session('acquisition', at(2, 9), [ok]);
		expect(caches(h.events).due).toBe(startOfStudyDay(dayIndex(at(2, 9), 0) + 1, 0));
	});

	it('counts late-night acquisition (before the rollover) for the previous study day', () => {
		const h = history();
		h.session('acquisition', at(1, 1), [ok]);
		// 01:00 on calendar day 1 is study day 0, so it is due at 04:00 the same morning.
		expect(caches(h.events).due).toBe(DAY0 + MS_PER_DAY + DAY_ROLLOVER_HOUR * MS_PER_HOUR);
	});

	for (const tz of [TZ_EAST, TZ_WEST]) {
		it(`counts the study day in the configured zone (offset ${tz})`, () => {
			const h = history();
			h.session('acquisition', at(0, 21), [ok]);
			expect(caches(h.events, tz).due).toBe(startOfStudyDay(dayIndex(at(0, 21), tz) + 1, tz));
		});
	}

	it('counts redo attempts and wrong answers as acquisition reviews', () => {
		const h = history();
		h.session('acquisition', at(0), [ok]);
		h.session('acquisition', at(1), [no, { firstAttempt: false, correct: true }]);
		expect(caches(h.events).due).toBe(startOfStudyDay(dayIndex(at(1), 0) + 1, 0));
	});

	it('takes due from the FSRS state once the retest has given one', () => {
		const h = history();
		h.session('acquisition', at(0), [ok]);
		h.session('longterm', at(1), [ok, ok, ok]);
		const c = caches(h.events);
		expect(c.fsrs).not.toBeNull();
		expect(c.due).toBe(c.fsrs?.due);
	});

	it('leaves a card with an FSRS state and later acquisition reviews on its FSRS due', () => {
		const h = history();
		h.session('longterm', at(0), [ok]);
		h.session('acquisition', at(3), [ok]);
		const c = caches(h.events);
		expect(c.due).toBe(c.fsrs?.due);
	});

	it('gives no due to a card with only pretests (no acquisition review)', () => {
		const pretest = makePretest({ id: eventId(9), cardId: CARD, ts: at(0) });
		const c = caches([pretest]);
		expect(c.fsrs).toBeNull();
		expect(c.due).toBeUndefined();
	});

	it('gives no due to a card with no events', () => {
		expect(caches([]).due).toBeUndefined();
	});

	it('is the same whatever order the events arrive in', () => {
		const h = history();
		h.session('acquisition', at(0), [ok, no]);
		h.session('acquisition', at(1), [ok]);
		expect(replay([...h.events].reverse(), [{ id: CARD, path: ['cloze'] }])).toStrictEqual(
			replay(h.events, [{ id: CARD, path: ['cloze'] }])
		);
	});
});

describe('replay: status around the handoff', () => {
	it('is learning after only uncredited acquisition reviews', () => {
		const h = history();
		h.session('acquisition', at(0), [ok, ok, ok]);
		expect(caches(h.events).status).toBe('learning');
	});

	it('is provisional, not exam-ready, after a next-day retest that meets the criterion', () => {
		const h = history();
		h.session('acquisition', at(0), [ok, ok, ok]);
		h.session(
			'longterm',
			at(1),
			Array.from({ length: CRITERION_FIRST }, () => ok)
		);
		const c = caches(h.events);
		expect(c.daysCorrect).toBe(1);
		expect(c.status).toBe('provisional');
	});

	it('is exam-ready only after a second credited day', () => {
		const h = history();
		h.session('acquisition', at(0), [ok]);
		h.session(
			'longterm',
			at(1),
			Array.from({ length: CRITERION_FIRST }, () => ok)
		);
		h.session('longterm', at(3), [ok]);
		expect(caches(h.events).status).toBe('exam-ready');
	});
});
