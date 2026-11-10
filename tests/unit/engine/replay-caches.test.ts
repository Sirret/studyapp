import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
	CRITERION_FIRST,
	CRITERION_FIRST_REDUCED,
	CRITERION_LATER,
	DAY_ROLLOVER_HOUR,
	FRAGILE_CAP_DAYS,
	FRAGILE_SPACED_GAP_DAYS,
	SECURE_STABILITY_DAYS
} from '#lib/config/defaults.ts';
import { CardCachesSchema, type CardCaches, type FsrsCardState } from '#lib/db/schemas/card.ts';
import type { CardId, ExerciseKind, Mode, SessionId, Weight } from '#lib/db/schemas/common.ts';
import type { ReviewEvent, StudyEvent } from '#lib/db/schemas/event.ts';
import { weightOf } from '#lib/engine/exercise-kinds.ts';
import {
	capStability,
	DEFAULT_FSRS_CONFIG,
	ratingFor,
	reviewFsrs,
	type FsrsConfig
} from '#lib/engine/fsrs.ts';
import { DEFAULT_REPLAY_CONFIG, replay, type ReplayConfig } from '#lib/engine/replay.ts';
import { dayIndex, MS_PER_DAY, startOfStudyDay } from '#lib/engine/time.ts';
import {
	arbEvents,
	arbShuffled,
	CARD_POOL,
	cardId,
	DEVICE_A,
	DEVICE_B,
	eventId,
	makePretest,
	makeReview,
	makeSelfRated,
	NUM_RUNS,
	uuid
} from './fixtures.ts';

const RUNS = { numRuns: NUM_RUNS };
const CARD_A = cardId(1);
const CARD_B = cardId(2);
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
/** Seconds between answers inside one session. */
const ANSWER_GAP_MS = 30_000;
/** Tue 1 Sep 2026, 00:00 UTC. */
const DAY0 = Date.UTC(2026, 8, 1);
/** UTC+2 and UTC−5, in minutes east of UTC. */
const TZ_EAST = 120;
const TZ_WEST = -300;
const UTC: ReplayConfig = { ...DEFAULT_REPLAY_CONFIG, tzOffsetMin: 0 };
const ONE_STEP: readonly ExerciseKind[] = ['cloze'];
const MC_PATH: readonly ExerciseKind[] = ['mc', 'cloze', 'newInstance'];
const MASSED: ReadonlySet<Mode> = new Set(['cram', 'onenight']);

/** UTC wall-clock time on calendar day `day` after DAY0. */
const at = (day: number, hour = 18, minute = 0): number =>
	DAY0 + day * MS_PER_DAY + hour * MS_PER_HOUR + minute * MS_PER_MINUTE;

/** The instant study day `day` begins (local DAY_ROLLOVER_HOUR) in a zone `tz` minutes east. */
const rollover = (day: number, tz: number): number =>
	DAY0 + day * MS_PER_DAY + DAY_ROLLOVER_HOUR * MS_PER_HOUR - tz * MS_PER_MINUTE;

const sessionId = (n: number) => uuid(0x5e000 + n) as SessionId;

type Answer = Partial<ReviewEvent>;
const ok: Answer = { correct: true };
const no: Answer = { correct: false };
const mc = (correct: boolean): Answer => ({ kind: 'mc', correct });
const OK3: readonly Answer[] = [ok, ok, ok];

/** Builds a history with unique ids and a strictly increasing `seq`. */
function history() {
	const events: StudyEvent[] = [];
	let n = 0;
	let sessions = 0;
	const next = () => {
		n += 1;
		return { id: eventId(0x1000 + n), seq: n, deviceId: DEVICE_A };
	};
	/** One session of answers, `ANSWER_GAP_MS` apart from `start`. Returns its review events. */
	function session(mode: Mode, start: number, answers: readonly Answer[], extra: Answer = {}) {
		sessions += 1;
		const sid = sessionId(sessions);
		return answers.map((answer, i) => {
			const kind = answer.kind ?? extra.kind ?? 'cloze';
			const event = makeReview({
				...next(),
				ts: start + i * ANSWER_GAP_MS,
				sessionId: sid,
				mode,
				kind,
				weight: weightOf(kind),
				credited: mode !== 'acquisition',
				...extra,
				...answer
			});
			events.push(event);
			return event;
		});
	}
	function selfRated(ts: number, kind: 'flip' | 'exampleStudy', card: CardId | undefined) {
		events.push(
			makeSelfRated({
				...next(),
				ts,
				kind,
				sessionId: sessionId(999),
				...(card ? { cardId: card } : {})
			})
		);
	}
	function pretest(ts: number) {
		events.push(makePretest({ ...next(), ts, cardId: CARD_A, sessionId: sessionId(998) }));
	}
	return { events, session, selfRated, pretest };
}

function cachesOf(
	events: readonly StudyEvent[],
	path: readonly ExerciseKind[] = ONE_STEP,
	config: ReplayConfig = UTC
): CardCaches {
	const caches = replay(events, [{ id: CARD_A, path }], config).result[CARD_A];
	if (!caches) throw new Error('replay returned no caches for the requested card');
	return caches;
}

/** The FSRS state the spec predicts from a list of FSRS reviews, built from fsrs.ts directly. */
function fsrsAfter(
	reviews: readonly Pick<ReviewEvent, 'ts' | 'weight' | 'correct' | 'mode'>[],
	config: FsrsConfig = DEFAULT_FSRS_CONFIG
): FsrsCardState | null {
	let state: FsrsCardState | null = null;
	for (const review of reviews) {
		const rating = ratingFor(review.weight as Weight, review.correct);
		if (rating === null) throw new Error('test bug: a none-weight review is not an FSRS review');
		let nextState: FsrsCardState = reviewFsrs(state, review.ts, rating, config).result;
		if (MASSED.has(review.mode) && review.correct) {
			nextState = capStability(nextState, Math.max(state?.stability ?? 0, FRAGILE_CAP_DAYS));
		}
		state = nextState;
	}
	return state;
}

describe('replay FSRS (§6.2, Decisions log: FSRS review = first counting event per session)', () => {
	it('applies one good review for a credited full-weight correct and copies due from it', () => {
		const h = history();
		const [first] = h.session('longterm', at(0), [ok]);
		const caches = cachesOf(h.events);
		expect(caches.fsrs).toStrictEqual(fsrsAfter([first!]));
		expect(caches.due).toBe(caches.fsrs?.due);
	});

	it('sends only the first counting event of a session to FSRS', () => {
		const h = history();
		const [first] = h.session('longterm', at(0), OK3);
		const caches = cachesOf(h.events);
		expect(caches.fsrs).toStrictEqual(fsrsAfter([first!]));
		expect(caches.fsrs?.reps).toBe(1);
		expect(caches.fsrs?.last_review).toBe(first!.ts);
	});

	it('rates a recognition-weight first counting event hard', () => {
		const h = history();
		const [first] = h.session('longterm', at(0), [mc(true), ok, ok]);
		expect(cachesOf(h.events).fsrs).toStrictEqual(fsrsAfter([first!]));
	});

	it('rates a wrong first counting event again, ignoring the redo and later corrects', () => {
		const h = history();
		const [first] = h.session('longterm', at(0), [no, { firstAttempt: false }, ok, ok, ok]);
		expect(cachesOf(h.events).fsrs).toStrictEqual(fsrsAfter([first!]));
	});

	it('skips a warm-up (none weight) and reviews the first counting event after it', () => {
		const h = history();
		const [, counting] = h.session('longterm', at(0), [
			{ kind: 'matching', correct: false },
			ok,
			ok
		]);
		const caches = cachesOf(h.events);
		expect(caches.fsrs).toStrictEqual(fsrsAfter([counting!]));
		expect(caches.fsrs?.last_review).toBe(counting!.ts);
	});

	it('skips a redo attempt that comes before any first attempt in the session', () => {
		const h = history();
		const [, counting] = h.session('longterm', at(0), [{ firstAttempt: false }, ok]);
		expect(cachesOf(h.events).fsrs).toStrictEqual(fsrsAfter([counting!]));
	});

	it('never touches FSRS with uncredited answers', () => {
		const h = history();
		h.session('acquisition', at(0), [ok, no, ok, ok, ok]);
		const caches = cachesOf(h.events);
		expect(caches.fsrs).toBeNull();
		// Phase 7 handoff (Decisions log): due the next study day, FSRS state still null.
		expect(caches.due).toBe(startOfStudyDay(dayIndex(at(0), 0) + 1, 0));
	});

	it('never touches FSRS with none-weight answers', () => {
		const h = history();
		h.session('longterm', at(0), [{ kind: 'matching' }, { kind: 'hotspot', correct: false }]);
		const caches = cachesOf(h.events);
		expect(caches.fsrs).toBeNull();
		expect(caches.due).toBeUndefined();
	});

	it('never touches FSRS with pretests or self-rated events', () => {
		const h = history();
		h.pretest(at(0));
		h.selfRated(at(0, 19), 'flip', CARD_A);
		expect(cachesOf(h.events).fsrs).toBeNull();
	});

	it('reviews once per session across days, in event order', () => {
		const h = history();
		const [d0] = h.session('longterm', at(0), OK3);
		const [d3] = h.session('longterm', at(3), [ok]);
		const [d10] = h.session('longterm', at(10), [no, { firstAttempt: false }, ok]);
		const caches = cachesOf(h.events);
		expect(caches.fsrs).toStrictEqual(fsrsAfter([d0!, d3!, d10!]));
		expect(caches.fsrs?.reps).toBe(3);
	});

	it('reviews once per session even for two sessions on the same day', () => {
		const h = history();
		const [s1] = h.session('longterm', at(0, 9), OK3);
		const [s2] = h.session('longterm', at(0, 20), [ok]);
		expect(cachesOf(h.events).fsrs).toStrictEqual(fsrsAfter([s1!, s2!]));
	});

	it('picks the first counting event per card when cards interleave in a session', () => {
		const h = history();
		const [a1, b1] = h.session('longterm', at(0), [ok, { cardId: CARD_B }, ok, { cardId: CARD_B }]);
		const { result } = replay(
			h.events,
			[
				{ id: CARD_A, path: ONE_STEP },
				{ id: CARD_B, path: ONE_STEP }
			],
			UTC
		);
		expect(result[CARD_A]?.fsrs).toStrictEqual(fsrsAfter([a1!]));
		expect(result[CARD_B]?.fsrs).toStrictEqual(fsrsAfter([b1!]));
	});

	it('uses the FSRS settings passed in the config', () => {
		const fsrs: FsrsConfig = { ...DEFAULT_FSRS_CONFIG, maximumIntervalDays: 2 };
		const h = history();
		const reviews = [0, 2, 4, 6].map((day) => h.session('longterm', at(day), OK3)[0]!);
		const caches = cachesOf(h.events, ONE_STEP, { ...UTC, fsrs });
		expect(caches.fsrs).toStrictEqual(fsrsAfter(reviews, fsrs));
		expect(caches.fsrs?.scheduled_days).toBeLessThanOrEqual(2);
	});
});

describe('replay status over days (§6.5, Decisions log: status, daysCorrect and lapses)', () => {
	it('stays unseen with only pretests and self-rated events', () => {
		const h = history();
		h.pretest(at(0));
		h.selfRated(at(0, 19), 'flip', CARD_A);
		const caches = cachesOf(h.events);
		expect(caches.status).toBe('unseen');
		expect(caches.daysCorrect).toBe(0);
	});

	it('is learning after uncredited acquisition answers only', () => {
		const h = history();
		h.session('acquisition', at(0), OK3);
		const caches = cachesOf(h.events);
		expect(caches.status).toBe('learning');
		expect(caches.daysCorrect).toBe(0);
	});

	it('is learning after none-weight answers only', () => {
		const h = history();
		h.session('longterm', at(0), [{ kind: 'matching' }]);
		expect(cachesOf(h.events).status).toBe('learning');
	});

	it('is learning after redo attempts only', () => {
		const h = history();
		h.session('longterm', at(0), [{ firstAttempt: false }]);
		expect(cachesOf(h.events).status).toBe('learning');
	});

	it('makes the next-day retest after acquisition the first credited day (its wrong is no lapse)', () => {
		const h = history();
		h.session('acquisition', at(0), OK3);
		h.session('longterm', at(1), [no, { firstAttempt: false }, ok, ok, ok]);
		const caches = cachesOf(h.events);
		expect(caches.daysCorrect).toBe(1);
		expect(caches.status).toBe('provisional');
	});

	it('walks provisional → exam-ready → needs-work → provisional → exam-ready over five days', () => {
		const days: [readonly Answer[], number, string][] = [
			[OK3, 1, 'provisional'],
			[[ok], 2, 'exam-ready'],
			[[no, { firstAttempt: false }, ok], 0, 'needs-work'],
			[[ok], 1, 'provisional'],
			[[ok], 2, 'exam-ready']
		];
		const h = history();
		days.forEach(([answers, daysCorrect, status], day) => {
			h.session('longterm', at(day), answers);
			const caches = cachesOf(h.events);
			expect({ day, daysCorrect: caches.daysCorrect, status: caches.status }).toStrictEqual({
				day,
				daysCorrect,
				status
			});
		});
	});

	it('keeps needs-work for the rest of the lapse day, even after a second correct session', () => {
		const h = history();
		h.session('longterm', at(0), OK3);
		h.session('longterm', at(1, 9), [no, { firstAttempt: false }, ok]);
		h.session('longterm', at(1, 20), [ok]);
		const caches = cachesOf(h.events);
		expect(caches.daysCorrect).toBe(0);
		expect(caches.status).toBe('needs-work');
	});

	it('does not lapse on a wrong that is not the day first counting event', () => {
		const h = history();
		h.session('longterm', at(0), OK3);
		h.session('longterm', at(1), [ok, no, { firstAttempt: false }, ok]);
		const caches = cachesOf(h.events);
		expect(caches.daysCorrect).toBe(2);
		expect(caches.status).toBe('exam-ready');
	});

	it('is needs-work when the only counting event is a wrong on the first day', () => {
		const h = history();
		h.session('longterm', at(0), [no]);
		expect(cachesOf(h.events).status).toBe('needs-work');
	});

	it('falls back to provisional when the last counting event is wrong', () => {
		const h = history();
		h.session('longterm', at(0), OK3);
		h.session('longterm', at(1), [ok, no]);
		const caches = cachesOf(h.events);
		expect(caches.daysCorrect).toBe(2);
		expect(caches.status).toBe('provisional');
	});

	it('becomes secure once FSRS stability reaches SECURE_STABILITY_DAYS over spaced correct days', () => {
		const h = history();
		const reviews = [0, 3, 17].map(
			(day, i) => h.session('longterm', at(day), i === 0 ? OK3 : [ok])[0]!
		);
		const predicted = fsrsAfter(reviews);
		expect(predicted?.stability).toBeGreaterThanOrEqual(SECURE_STABILITY_DAYS);
		const caches = cachesOf(h.events);
		expect(caches.fsrs).toStrictEqual(predicted);
		expect(caches.fragile).toBe(false);
		expect(caches.status).toBe('secure');
	});

	it('is not secure yet when stability is still below SECURE_STABILITY_DAYS', () => {
		const h = history();
		const reviews = [0, 3].map(
			(day, i) => h.session('longterm', at(day), i === 0 ? OK3 : [ok])[0]!
		);
		expect(fsrsAfter(reviews)?.stability).toBeLessThan(SECURE_STABILITY_DAYS);
		expect(cachesOf(h.events).status).toBe('exam-ready');
	});

	it('is one-night after one-night study only, never exam-ready', () => {
		const h = history();
		h.session('onenight', at(0, 20), [...OK3, ok]);
		const caches = cachesOf(h.events);
		expect(caches.status).toBe('one-night');
		expect(caches.daysCorrect).toBe(1);
	});

	it('leaves one-night after a later-day long-term correct (exam-ready at two days)', () => {
		const h = history();
		h.session('onenight', at(0, 20), OK3);
		h.session('longterm', at(1), [ok]);
		const caches = cachesOf(h.events);
		expect(caches.daysCorrect).toBe(2);
		expect(caches.status).toBe('exam-ready');
	});

	it('is exam-ready after one cram session that met its criterion (CONCEPT §7)', () => {
		const h = history();
		h.session('cram', at(0), OK3);
		const caches = cachesOf(h.events);
		expect(caches.daysCorrect).toBe(1);
		expect(caches.status).toBe('exam-ready');
	});

	it('is provisional after a cram session whose last counting correct was recognition', () => {
		const h = history();
		// The pretest keeps the first-session criterion at CRITERION_FIRST (no known-on-first-try).
		h.pretest(at(0, 17));
		h.session('cram', at(0), [ok, ok, mc(true)]);
		expect(cachesOf(h.events).status).toBe('provisional');
	});

	it('is provisional after a new card cram session short of CRITERION_FIRST', () => {
		const h = history();
		h.pretest(at(0, 17));
		h.session(
			'cram',
			at(0),
			Array.from({ length: CRITERION_FIRST - 1 }, () => ok)
		);
		expect(cachesOf(h.events).status).toBe('provisional');
	});

	it('needs only CRITERION_LATER in a cram session once the card has met its criterion', () => {
		const h = history();
		h.session('longterm', at(0, 9), OK3);
		h.session('cram', at(0, 20), [ok]);
		expect(cachesOf(h.events).status).toBe('exam-ready');
	});

	it('drops the cram exam-ready when a later credited session is not cram', () => {
		const h = history();
		h.session('cram', at(0, 9), OK3);
		h.session('longterm', at(0, 20), [ok]);
		expect(cachesOf(h.events).status).toBe('provisional');
	});

	it('keeps the cram exam-ready through a later uncredited session', () => {
		const h = history();
		h.session('cram', at(0, 9), OK3);
		h.session('acquisition', at(0, 20), [no]);
		expect(cachesOf(h.events).status).toBe('exam-ready');
	});
});

describe('replay study days with a time-zone offset (§6.1, Decisions log: tzOffsetMin)', () => {
	const east: ReplayConfig = { ...UTC, tzOffsetMin: TZ_EAST };
	const west: ReplayConfig = { ...UTC, tzOffsetMin: TZ_WEST };

	function twoSessions(secondTs: number) {
		const h = history();
		h.session('longterm', at(0, 12), OK3);
		h.session('longterm', secondTs, [ok]);
		return h.events;
	}

	it('counts a review one minute before local DAY_ROLLOVER_HOUR as the previous day (UTC+2)', () => {
		const ts = rollover(1, TZ_EAST) - MS_PER_MINUTE;
		expect(dayIndex(ts, TZ_EAST)).toBe(dayIndex(at(0, 12), TZ_EAST));
		expect(cachesOf(twoSessions(ts), ONE_STEP, east).daysCorrect).toBe(1);
	});

	it('counts a review exactly at local DAY_ROLLOVER_HOUR as the next day (UTC+2)', () => {
		const ts = rollover(1, TZ_EAST);
		expect(dayIndex(ts, TZ_EAST)).toBe(dayIndex(at(0, 12), TZ_EAST) + 1);
		const caches = cachesOf(twoSessions(ts), ONE_STEP, east);
		expect(caches.daysCorrect).toBe(2);
		expect(caches.status).toBe('exam-ready');
	});

	it('uses the offset passed in: the same events give different days in UTC and UTC+2', () => {
		const events = twoSessions(at(1, DAY_ROLLOVER_HOUR - 1));
		expect(cachesOf(events, ONE_STEP, UTC).daysCorrect).toBe(1);
		expect(cachesOf(events, ONE_STEP, east).daysCorrect).toBe(2);
	});

	it('handles a negative offset at the rollover boundary (UTC−5)', () => {
		expect(
			cachesOf(twoSessions(rollover(1, TZ_WEST) - MS_PER_MINUTE), ONE_STEP, west).daysCorrect
		).toBe(1);
		expect(cachesOf(twoSessions(rollover(1, TZ_WEST)), ONE_STEP, west).daysCorrect).toBe(2);
	});

	it('defaults to UTC study days', () => {
		const events = twoSessions(at(1, DAY_ROLLOVER_HOUR - 1));
		expect(replay(events, [{ id: CARD_A, path: ONE_STEP }]).result[CARD_A]?.daysCorrect).toBe(1);
	});
});

describe('replay fragile (CONCEPT §7 cram-fragile, Decisions log: massed modes and fragile)', () => {
	it('caps a cram correct and marks the card fragile', () => {
		const h = history();
		const [first] = h.session('cram', at(0), OK3);
		const caches = cachesOf(h.events);
		expect(caches.fsrs).toStrictEqual(fsrsAfter([first!]));
		expect(caches.fsrs?.stability).toBeLessThanOrEqual(FRAGILE_CAP_DAYS);
		expect(caches.fragile).toBe(true);
		expect((caches.due ?? Infinity) - first!.ts).toBeLessThanOrEqual(FRAGILE_CAP_DAYS * MS_PER_DAY);
	});

	it('caps a one-night correct the same way', () => {
		const h = history();
		const [first] = h.session('onenight', at(0, 21), OK3);
		const caches = cachesOf(h.events);
		expect(caches.fsrs).toStrictEqual(fsrsAfter([first!]));
		expect(caches.fragile).toBe(true);
	});

	it('does not mark a long-term correct fragile', () => {
		const h = history();
		h.session('longterm', at(0), OK3);
		expect(cachesOf(h.events).fragile).toBe(false);
	});

	it('does not let a cram pass lower or raise an already stable card, and keeps it not fragile', () => {
		const h = history();
		const reviews = [0, 3, 17].map(
			(day, i) => h.session('longterm', at(day), i === 0 ? OK3 : [ok])[0]!
		);
		const before = fsrsAfter(reviews);
		const [cram] = h.session('cram', at(18), [ok]);
		const caches = cachesOf(h.events);
		expect(caches.fsrs).toStrictEqual(fsrsAfter([...reviews, cram!]));
		expect(caches.fsrs?.stability).toBeLessThanOrEqual(before?.stability ?? -1);
		expect(caches.fragile).toBe(false);
		expect(caches.status).toBe('secure');
	});

	it('clears fragile with a long-term correct FRAGILE_SPACED_GAP_DAYS study days later', () => {
		const h = history();
		const [cram] = h.session('cram', at(0, 22), OK3);
		const [longterm] = h.session('longterm', rollover(FRAGILE_SPACED_GAP_DAYS, 0), [ok]);
		const caches = cachesOf(h.events);
		expect(caches.fragile).toBe(false);
		expect(caches.fsrs).toStrictEqual(fsrsAfter([cram!, longterm!]));
	});

	it('keeps fragile after a long-term correct on the same study day, even after midnight', () => {
		const h = history();
		h.session('cram', at(0, 22), OK3);
		h.session('longterm', rollover(FRAGILE_SPACED_GAP_DAYS, 0) - MS_PER_MINUTE, [ok]);
		expect(cachesOf(h.events).fragile).toBe(true);
	});

	it('keeps fragile after a wrong long-term review a day later', () => {
		const h = history();
		h.session('cram', at(0), OK3);
		h.session('longterm', at(FRAGILE_SPACED_GAP_DAYS), [no, { firstAttempt: false }, ok]);
		expect(cachesOf(h.events).fragile).toBe(true);
	});

	it('keeps fragile after another cram correct a day later', () => {
		const h = history();
		h.session('cram', at(0), OK3);
		h.session('cram', at(FRAGILE_SPACED_GAP_DAYS), [ok]);
		const caches = cachesOf(h.events);
		expect(caches.fragile).toBe(true);
		expect(caches.fsrs?.stability).toBeLessThanOrEqual(FRAGILE_CAP_DAYS);
	});

	it('keeps fragile after long-term answers that are not FSRS reviews (uncredited, none weight)', () => {
		const h = history();
		h.session('cram', at(0), OK3);
		h.session('longterm', at(1), [{ kind: 'matching' }]);
		h.session('longterm', at(2), [ok], { credited: false });
		expect(cachesOf(h.events).fragile).toBe(true);
	});

	it('measures the gap from the previous FSRS review, not from the cram review', () => {
		const h = history();
		h.session('cram', at(0), OK3);
		h.session('longterm', at(1, 9), [no, { firstAttempt: false }, ok]);
		h.session('longterm', at(1, 20), [ok]);
		expect(cachesOf(h.events).fragile).toBe(true);
		h.session('longterm', at(2), [ok]);
		expect(cachesOf(h.events).fragile).toBe(false);
	});

	it('keeps fragile after a credited acquisition correct a day later', () => {
		// SPEC-GAP: only a `longterm` correct clears fragile per the Decisions log; read literally,
		// a credited acquisition-mode review does not.
		const h = history();
		h.session('cram', at(0), OK3);
		h.session('acquisition', at(1), [ok], { credited: true });
		expect(cachesOf(h.events).fragile).toBe(true);
	});

	it('does not cap or mark fragile when the cram FSRS review is wrong', () => {
		// SPEC-GAP: the cap and fragile rule speak of a *correct* massed FSRS review; a wrong one
		// is read as an ordinary uncapped review that leaves fragile unchanged.
		const h = history();
		const [first] = h.session('cram', at(0), [no, { firstAttempt: false }, ...OK3]);
		const caches = cachesOf(h.events);
		expect(caches.fsrs).toStrictEqual(fsrsAfter([first!]));
		expect(caches.fragile).toBe(false);
	});
});

describe('replay weak (Decisions log: weak, §6.4 failed relearn)', () => {
	const weakOf = (build: (h: ReturnType<typeof history>) => void): boolean => {
		const h = history();
		build(h);
		return cachesOf(h.events).weak;
	};

	it('is weak after a relearning session (criterion met before it) with a wrong counting event', () => {
		expect(
			weakOf((h) => {
				h.session('longterm', at(0), OK3);
				h.session('longterm', at(1), [no, { firstAttempt: false }, ok]);
			})
		).toBe(true);
	});

	it('is weak when the relearn wrong comes after a correct in the session', () => {
		expect(
			weakOf((h) => {
				h.session('longterm', at(0), OK3);
				h.session('longterm', at(1), [ok, no, { firstAttempt: false }, ok]);
			})
		).toBe(true);
	});

	it('is not weak after a clean relearn session', () => {
		expect(
			weakOf((h) => {
				h.session('longterm', at(0), OK3);
				h.session('longterm', at(1), [ok]);
			})
		).toBe(false);
	});

	it('is not weak after errors in a first session (not a relearning session)', () => {
		expect(weakOf((h) => h.session('longterm', at(0), [no, { firstAttempt: false }, ...OK3]))).toBe(
			false
		);
	});

	it('is not weak when an abandoned first session left the card still needing CRITERION_FIRST', () => {
		expect(
			weakOf((h) => {
				// Cram after a pretest needs CRITERION_FIRST, so two corrects leave it unmet.
				h.pretest(at(0, 17));
				h.session('cram', at(0), [ok, ok]);
				h.session('longterm', at(1), [no, { firstAttempt: false }, ...OK3]);
			})
		).toBe(false);
	});

	it('clears weak on the next clean credited session', () => {
		expect(
			weakOf((h) => {
				h.session('longterm', at(0), OK3);
				h.session('longterm', at(1), [no, { firstAttempt: false }, ok]);
				h.session('longterm', at(2), [ok]);
			})
		).toBe(false);
	});

	it('keeps weak through a later uncredited session', () => {
		expect(
			weakOf((h) => {
				h.session('longterm', at(0), OK3);
				h.session('longterm', at(1), [no, { firstAttempt: false }, ok]);
				h.session('acquisition', at(2), [ok]);
			})
		).toBe(true);
	});

	it('ignores a wrong none-weight answer or a wrong redo in a relearn session', () => {
		expect(
			weakOf((h) => {
				h.session('longterm', at(0), OK3);
				h.session('longterm', at(1), [{ kind: 'matching', correct: false }, ok]);
			})
		).toBe(false);
		expect(
			weakOf((h) => {
				h.session('longterm', at(0), OK3);
				h.session('longterm', at(1), [ok, { firstAttempt: false, correct: false }]);
			})
		).toBe(false);
	});

	it('is weak after a failed relearn in cram mode too', () => {
		expect(
			weakOf((h) => {
				h.session('longterm', at(0), OK3);
				h.session('cram', at(1), [no, { firstAttempt: false }, ok]);
			})
		).toBe(true);
	});
});

describe('replay pathStep (Decisions log: pathStep)', () => {
	const stepOf = (
		path: readonly ExerciseKind[],
		build: (h: ReturnType<typeof history>) => void
	) => {
		const h = history();
		build(h);
		return cachesOf(h.events, path).pathStep;
	};

	it('starts at 0', () => {
		expect(stepOf(MC_PATH, () => undefined)).toBe(0);
	});

	it('moves past a step on a correct first attempt of that step kind', () => {
		expect(stepOf(MC_PATH, (h) => h.session('longterm', at(0), [mc(true)]))).toBe(1);
		expect(stepOf(MC_PATH, (h) => h.session('longterm', at(0), [mc(true), ok]))).toBe(2);
	});

	it('does not move on a wrong first attempt', () => {
		expect(stepOf(MC_PATH, (h) => h.session('longterm', at(0), [mc(false)]))).toBe(0);
	});

	it('does not move on a correct redo attempt', () => {
		expect(
			stepOf(MC_PATH, (h) =>
				h.session('longterm', at(0), [mc(false), { kind: 'mc', firstAttempt: false }])
			)
		).toBe(0);
	});

	it('clamps at the last step', () => {
		expect(
			stepOf(MC_PATH, (h) =>
				h.session('longterm', at(0), [
					mc(true),
					ok,
					{ kind: 'newInstance' },
					{ kind: 'newInstance' }
				])
			)
		).toBe(MC_PATH.length - 1);
		expect(stepOf(ONE_STEP, (h) => h.session('longterm', at(0), OK3))).toBe(0);
	});

	it('never moves back on a correct of an earlier step kind', () => {
		expect(stepOf(MC_PATH, (h) => h.session('longterm', at(0), [mc(true), ok, mc(true)]))).toBe(2);
		expect(stepOf(MC_PATH, (h) => h.session('longterm', at(0), [mc(true), mc(true)]))).toBe(1);
	});

	it('skips an MC step once accuracy reaches MC_UNTIL_ACCURACY, moving past the later step answered', () => {
		// Corrects of a kind not on the path raise accuracy to 1 without moving pathStep.
		const steps = stepOf(MC_PATH, (h) =>
			h.session('longterm', at(0), [
				{ kind: 'sequence' },
				{ kind: 'sequence' },
				{ kind: 'sequence' },
				ok
			])
		);
		expect(steps).toBe(2);
	});

	it('moves past a step on a none-weight review of that kind, even a wrong one', () => {
		const path: ExerciseKind[] = ['matching', 'cloze'];
		expect(
			stepOf(path, (h) => h.session('longterm', at(0), [{ kind: 'matching', correct: false }]))
		).toBe(1);
	});

	it('does not move on a none-weight review of another kind', () => {
		expect(stepOf(MC_PATH, (h) => h.session('longterm', at(0), [{ kind: 'matching' }]))).toBe(0);
	});

	it('moves past a step on a self-rated event of that kind tied to the card', () => {
		const path: ExerciseKind[] = ['exampleStudy', 'fadeStep', 'newInstance'];
		expect(stepOf(path, (h) => h.selfRated(at(0), 'exampleStudy', CARD_A))).toBe(1);
	});

	it('ignores self-rated events not tied to this card', () => {
		const path: ExerciseKind[] = ['exampleStudy', 'fadeStep'];
		expect(stepOf(path, (h) => h.selfRated(at(0), 'exampleStudy', undefined))).toBe(0);
		expect(stepOf(path, (h) => h.selfRated(at(0), 'exampleStudy', CARD_B))).toBe(0);
	});

	it('moves on an uncredited acquisition correct of the step kind', () => {
		// SPEC-GAP: the pathStep rule names first-attempt correctness only, not credit; read as
		// "uncredited chunk-quiz answers also climb the path".
		expect(stepOf(MC_PATH, (h) => h.session('acquisition', at(0), [mc(true)]))).toBe(1);
	});
});

describe('replay caches: validity and determinism (§6.12)', () => {
	function realisticHistory(): StudyEvent[] {
		const h = history();
		h.session('acquisition', at(0, 17), [mc(true), mc(false), ok]);
		h.session('longterm', at(1), [no, { firstAttempt: false }, ok, ok, { cardId: CARD_B }, ok]);
		h.session('longterm', at(2), [ok, { cardId: CARD_B, correct: false }, { kind: 'matching' }]);
		h.selfRated(at(2, 19), 'flip', CARD_A);
		h.session('cram', at(3, 22), [ok, { cardId: CARD_B }, { cardId: CARD_B }, { cardId: CARD_B }]);
		h.session('longterm', rollover(4, TZ_EAST) - MS_PER_MINUTE, [ok, { cardId: CARD_B }], {
			deviceId: DEVICE_B
		});
		h.session('onenight', at(5, 23), [{ cardId: CARD_B }]);
		return h.events;
	}
	const cards = [
		{ id: CARD_A, path: MC_PATH },
		{ id: CARD_B, path: ONE_STEP }
	];
	const east: ReplayConfig = { ...UTC, tzOffsetMin: TZ_EAST };

	it('produces caches that parse with CardCachesSchema and keep pathStep inside the path', () => {
		const { result } = replay(realisticHistory(), cards, east);
		for (const card of cards) {
			const caches = result[card.id];
			expect(CardCachesSchema.safeParse(caches).success).toBe(true);
			expect(caches!.pathStep).toBeLessThan(card.path.length);
		}
	});

	it('gives an identical result and trace whatever order a realistic history arrives in', () => {
		const events = realisticHistory();
		const expected = replay(events, cards, east);
		fc.assert(
			fc.property(arbShuffled(events), (shuffled) => {
				expect(replay(shuffled, cards, east)).toStrictEqual(expected);
			}),
			RUNS
		);
	});

	it('keeps caches valid and order-independent on arbitrary events', () => {
		const poolCards = CARD_POOL.map((id) => ({ id, path: MC_PATH }));
		fc.assert(
			fc.property(
				arbEvents.chain((events) => fc.tuple(fc.constant(events), arbShuffled(events))),
				([events, shuffled]) => {
					const first = replay(events, poolCards);
					expect(replay(shuffled, poolCards)).toStrictEqual(first);
					for (const { id } of poolCards) {
						const caches = first.result[id];
						expect(CardCachesSchema.safeParse(caches).success).toBe(true);
						expect(caches!.pathStep).toBeLessThan(MC_PATH.length);
					}
				}
			),
			RUNS
		);
	});

	it('writes due only when there is an FSRS state, equal to its due', () => {
		const { result } = replay(realisticHistory(), cards, east);
		for (const { id } of cards) {
			const caches = result[id]!;
			if (caches.fsrs === null) expect(caches.due).toBeUndefined();
			else expect(caches.due).toBe(caches.fsrs.due);
		}
	});
});

/** Status after the history `build` makes; a lone cram session is exam-ready only if it met its criterion. */
const statusOf = (build: (h: ReturnType<typeof history>) => void) => {
	const h = history();
	build(h);
	return cachesOf(h.events).status;
};

/**
 * Whether the card had met its criterion after `build`: a failed session on a later study day makes
 * it weak only if that session was a relearning session (Decisions log: weak).
 */
const metBeforeProbe = (build: (h: ReturnType<typeof history>) => void, probeDay = 1): boolean => {
	const h = history();
	build(h);
	h.session('longterm', at(probeDay, 20), [no, { firstAttempt: false }, ok]);
	return cachesOf(h.events).weak;
};

const oks = (n: number): Answer[] => Array.from({ length: n }, () => ok);

describe('replay criterion count from event `required` (§6.3, Decisions log: review events carry required)', () => {
	it('uses the event required over the derived count: a first cram session with required 2 is met after 2', () => {
		const build = (required?: number) => (h: ReturnType<typeof history>) => {
			h.pretest(at(0, 17));
			h.session('cram', at(0), [ok, ok], required === undefined ? {} : { required });
		};
		expect(statusOf(build(CRITERION_FIRST_REDUCED))).toBe('exam-ready');
		expect(metBeforeProbe(build(CRITERION_FIRST_REDUCED))).toBe(true);
		// Without `required`, cram after a pretest derives CRITERION_FIRST: two corrects fall short.
		expect(statusOf(build())).toBe('provisional');
		expect(metBeforeProbe(build())).toBe(false);
	});

	it('uses an event required of CRITERION_FIRST even where derivation would reduce it', () => {
		// Known on first try would derive CRITERION_FIRST_REDUCED; the event says what the session asked.
		expect(statusOf((h) => h.session('cram', at(0), [ok, ok], { required: CRITERION_FIRST }))).toBe(
			'provisional'
		);
	});

	it('uses required 1 on a relearning session', () => {
		expect(
			statusOf((h) => {
				h.session('longterm', at(0, 9), OK3);
				h.session('cram', at(0, 20), [ok], { required: CRITERION_LATER });
			})
		).toBe('exam-ready');
	});

	it('uses an event required above CRITERION_LATER on a relearning session', () => {
		// Same study day, so daysCorrect stays 1: exam-ready would need the cram criterion met.
		expect(
			statusOf((h) => {
				h.session('longterm', at(0, 9), OK3);
				h.session('cram', at(0, 20), [ok], { required: CRITERION_FIRST_REDUCED });
			})
		).toBe('provisional');
	});
});

describe('replay criterion count derived without `required` (§6.3 adaptive first session, Decisions log)', () => {
	it('reduces a longterm first session to CRITERION_FIRST_REDUCED', () => {
		const longterm = (answers: readonly Answer[]) => (h: ReturnType<typeof history>) => {
			h.pretest(at(0, 17));
			h.session('longterm', at(0), answers);
		};
		expect(metBeforeProbe(longterm(oks(CRITERION_FIRST_REDUCED)))).toBe(true);
		expect(metBeforeProbe(longterm(oks(CRITERION_FIRST_REDUCED - 1)))).toBe(false);
	});

	it('keeps CRITERION_FIRST for a cram first session when no reduction applies', () => {
		const cram = (answers: readonly Answer[]) => (h: ReturnType<typeof history>) => {
			h.pretest(at(0, 17));
			h.session('cram', at(0), answers);
		};
		expect(statusOf(cram(oks(CRITERION_FIRST - 1)))).toBe('provisional');
		expect(statusOf(cram(oks(CRITERION_FIRST)))).toBe('exam-ready');
		expect(metBeforeProbe(cram(oks(CRITERION_FIRST - 1)))).toBe(false);
	});

	it('reduces to CRITERION_FIRST_REDUCED when the first try ever is a correct full answer', () => {
		expect(statusOf((h) => h.session('cram', at(0), oks(CRITERION_FIRST_REDUCED)))).toBe(
			'exam-ready'
		);
	});

	it('reduces when the first try ever is a correct recognition answer (the final correct is full)', () => {
		expect(statusOf((h) => h.session('cram', at(0), [mc(true), ok]))).toBe('exam-ready');
	});

	it('counts a correct first try in an earlier uncredited acquisition session as known on first try', () => {
		expect(
			statusOf((h) => {
				h.session('acquisition', at(0), [ok]);
				h.session('cram', at(1), [ok, ok]);
			})
		).toBe('exam-ready');
		expect(
			statusOf((h) => {
				h.session('acquisition', at(0), [no, { firstAttempt: false }]);
				h.session('cram', at(1), [ok, ok]);
			})
		).toBe('provisional');
	});

	it('does not count a first try as known when a pretest came before it', () => {
		expect(
			statusOf((h) => {
				h.pretest(at(0, 17));
				h.session('cram', at(0), [ok, ok]);
			})
		).toBe('provisional');
	});

	it('still counts the first try as known when the pretest came only after it', () => {
		expect(
			statusOf((h) => {
				h.session('acquisition', at(0, 9), [ok]);
				h.pretest(at(0, 12));
				h.session('cram', at(1), [ok, ok]);
			})
		).toBe('exam-ready');
	});

	it('does not count a none-weight first review as known on first try', () => {
		expect(statusOf((h) => h.session('cram', at(0), [{ kind: 'matching' }, ok, ok]))).toBe(
			'provisional'
		);
		expect(statusOf((h) => h.session('cram', at(0), [{ kind: 'matching' }, ...OK3]))).toBe(
			'exam-ready'
		);
	});

	it('does not count a wrong first try as known on first try', () => {
		expect(statusOf((h) => h.session('cram', at(0), [no, { firstAttempt: false }, ok, ok]))).toBe(
			'provisional'
		);
		expect(statusOf((h) => h.session('cram', at(0), [no, { firstAttempt: false }, ...OK3]))).toBe(
			'exam-ready'
		);
	});

	it('drops the session count right after a first-ever correct that comes mid-session', () => {
		// Card B is answered first, so card A's first try ever happens inside a running session.
		const h = history();
		h.session('cram', at(0), [{ cardId: CARD_B }, ok, { cardId: CARD_B }, ok]);
		const { result } = replay(
			h.events,
			[
				{ id: CARD_A, path: ONE_STEP },
				{ id: CARD_B, path: ONE_STEP }
			],
			UTC
		);
		expect(result[CARD_A]?.status).toBe('exam-ready');
		expect(result[CARD_B]?.status).toBe('exam-ready');
	});
});

describe('replay weak with the adaptive criterion (Decisions log: weak = failed relearning session)', () => {
	const weakOf = (build: (h: ReturnType<typeof history>) => void): boolean => {
		const h = history();
		build(h);
		return cachesOf(h.events).weak;
	};

	it('treats the session after a longterm first session met at CRITERION_FIRST_REDUCED as a relearn', () => {
		expect(
			weakOf((h) => {
				h.pretest(at(0, 17));
				h.session('longterm', at(0), [ok, ok]);
				h.session('longterm', at(1), [no, { firstAttempt: false }, ok]);
			})
		).toBe(true);
	});

	it('is not weak from a cleanup event with required 1 in a first session', () => {
		const first = { required: CRITERION_FIRST_REDUCED };
		const cleanup = { required: CRITERION_LATER };
		const main: Answer[] = [
			{ ...no, ...first },
			{ firstAttempt: false, ...first },
			{ ...ok, ...first },
			{ ...ok, ...first }
		];
		expect(weakOf((h) => h.session('longterm', at(0), [...main, { ...ok, ...cleanup }]))).toBe(
			false
		);
		expect(
			weakOf((h) =>
				h.session('longterm', at(0), [
					...main,
					{ ...no, ...cleanup },
					{ firstAttempt: false, ...cleanup }
				])
			)
		).toBe(false);
	});

	it('is weak after a failed relearning session whose events carry required 1', () => {
		const later = { required: CRITERION_LATER };
		expect(
			weakOf((h) => {
				h.session('longterm', at(0), OK3);
				h.session('longterm', at(1), [
					{ ...no, ...later },
					{ firstAttempt: false, ...later },
					{ ...ok, ...later }
				]);
			})
		).toBe(true);
	});

	it('treats a session after a first session met through its event required as a relearn', () => {
		expect(
			weakOf((h) => {
				h.pretest(at(0, 17));
				h.session('cram', at(0), [ok, ok], { required: CRITERION_FIRST_REDUCED });
				h.session('longterm', at(1), [no, { firstAttempt: false }, ok]);
			})
		).toBe(true);
	});
});
