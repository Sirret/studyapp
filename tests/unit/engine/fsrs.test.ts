import { describe, expect, it } from 'vitest';
import {
	FRAGILE_CAP_DAYS,
	FSRS_MAXIMUM_INTERVAL_DAYS,
	RETENTION,
	RETENTION_MAX,
	RETENTION_MIN
} from '#lib/config/defaults.ts';
import { FsrsCardStateSchema, type FsrsCardState } from '#lib/db/schemas/card.ts';
import type { Weight } from '#lib/db/schemas/common.ts';
import {
	capStability,
	DEFAULT_FSRS_CONFIG,
	ratingFor,
	retrievabilityAt,
	reviewFsrs,
	type FsrsConfig,
	type FsrsRating
} from '#lib/engine/fsrs.ts';
import { MS_PER_DAY } from '#lib/engine/time.ts';
import { deepFreeze } from './fixtures.ts';

/** 1 Sep 2026, 10:00 UTC: a realistic epoch-ms review time. */
const NOW = Date.UTC(2026, 8, 1, 10, 0, 0);
const RATINGS: readonly FsrsRating[] = ['again', 'hard', 'good'];
const WEIGHTS: readonly Weight[] = ['full', 'recognition', 'none'];
/** FSRS defines stability as the gap at which predicted recall falls to 90%. */
const FSRS_STABILITY_RECALL = 0.9;
/** A gap of several weeks, for "time passes" checks. */
const LATER_DAYS = 30;

/** Reviews a card `good` at each due date, `times` times, starting new at `NOW`. */
function goodChain(times: number, config: FsrsConfig = DEFAULT_FSRS_CONFIG): FsrsCardState[] {
	const states: FsrsCardState[] = [];
	let state: FsrsCardState | null = null;
	let ts = NOW;
	for (let i = 0; i < times; i += 1) {
		state = reviewFsrs(state, ts, 'good', config).result;
		states.push(state);
		ts = state.due;
	}
	return states;
}

/** A hand-built review-state card, independent of the module under test. */
function stateWith(overrides: Partial<FsrsCardState> = {}): FsrsCardState {
	const stability = overrides.stability ?? 10;
	const scheduled = overrides.scheduled_days ?? 10;
	return {
		due: NOW + scheduled * MS_PER_DAY,
		stability,
		difficulty: 5,
		scheduled_days: scheduled,
		learning_steps: 0,
		reps: 3,
		lapses: 1,
		state: 2,
		last_review: NOW,
		...overrides
	};
}

describe('ratingFor (§6.2 rating map)', () => {
	it('maps a full-weight correct to good', () => {
		expect(ratingFor('full', true)).toBe('good');
	});

	it('maps a recognition-weight correct to hard', () => {
		expect(ratingFor('recognition', true)).toBe('hard');
	});

	it('maps a wrong full-weight answer to again', () => {
		expect(ratingFor('full', false)).toBe('again');
	});

	it('maps a wrong recognition-weight answer to again', () => {
		expect(ratingFor('recognition', false)).toBe('again');
	});

	it('never sends a none-weight answer to FSRS, right or wrong', () => {
		expect(ratingFor('none', true)).toBeNull();
		expect(ratingFor('none', false)).toBeNull();
	});

	it('never auto-assigns easy', () => {
		for (const weight of WEIGHTS) {
			for (const correct of [true, false]) {
				expect([...RATINGS, null]).toContain(ratingFor(weight, correct));
			}
		}
	});
});

describe('reviewFsrs (§6.2)', () => {
	it('treats a null state as a new card and returns a valid FsrsCardState', () => {
		for (const rating of RATINGS) {
			const { result } = reviewFsrs(null, NOW, rating);
			expect(FsrsCardStateSchema.safeParse(result).success).toBe(true);
			expect(result.reps).toBe(1);
			expect(result.last_review).toBe(NOW);
		}
	});

	it('stores dates as epoch ms numbers', () => {
		const { result } = reviewFsrs(null, NOW, 'good');
		expect(typeof result.due).toBe('number');
		expect(typeof result.last_review).toBe('number');
	});

	it('has short-term steps off: even a first review is due at least a day later', () => {
		for (const rating of RATINGS) {
			const { result } = reviewFsrs(null, NOW, rating);
			expect(result.scheduled_days).toBeGreaterThanOrEqual(1);
			expect(result.due - NOW).toBeGreaterThanOrEqual(MS_PER_DAY);
		}
	});

	it('sets due to the review time plus scheduled_days whole days', () => {
		for (const state of goodChain(4)) {
			expect(state.due).toBe((state.last_review ?? Number.NaN) + state.scheduled_days * MS_PER_DAY);
		}
	});

	it('has fuzz off: the same state and rating give the same interval at a different time', () => {
		const a = reviewFsrs(null, NOW, 'good').result;
		const b = reviewFsrs(null, NOW + 12_345_678, 'good').result;
		expect(b.scheduled_days).toBe(a.scheduled_days);
		expect(b.stability).toBe(a.stability);
		expect(b.difficulty).toBe(a.difficulty);
	});

	it('is deterministic: the same inputs give an identical result and trace', () => {
		const prev = reviewFsrs(null, NOW, 'good').result;
		const first = reviewFsrs(prev, prev.due, 'hard');
		const second = reviewFsrs(prev, prev.due, 'hard');
		expect(second).toStrictEqual(first);
	});

	it('returns a trace of entries with a rule', () => {
		const { trace } = reviewFsrs(null, NOW, 'good');
		expect(Array.isArray(trace)).toBe(true);
		for (const entry of trace) expect(typeof entry.rule).toBe('string');
	});

	it('does not mutate the input state', () => {
		const prev = deepFreeze(reviewFsrs(null, NOW, 'good').result);
		const copy = structuredClone(prev);
		reviewFsrs(prev, prev.due, 'again');
		expect(prev).toStrictEqual(copy);
	});

	it('gives good a longer interval than hard, and hard no shorter than again, on a new card', () => {
		const [again, hard, good] = RATINGS.map((r) => reviewFsrs(null, NOW, r).result);
		expect(good!.scheduled_days).toBeGreaterThan(hard!.scheduled_days);
		expect(hard!.scheduled_days).toBeGreaterThanOrEqual(again!.scheduled_days);
		expect(good!.stability).toBeGreaterThan(hard!.stability);
	});

	it('gives good a longer interval than hard on a reviewed card', () => {
		const prev = reviewFsrs(null, NOW, 'good').result;
		const hard = reviewFsrs(prev, prev.due, 'hard').result;
		const good = reviewFsrs(prev, prev.due, 'good').result;
		expect(good.scheduled_days).toBeGreaterThan(hard.scheduled_days);
	});

	it('grows the interval across successive good reviews at the due date', () => {
		const chain = goodChain(4);
		for (let i = 1; i < chain.length; i += 1) {
			expect(chain[i]!.scheduled_days).toBeGreaterThan(chain[i - 1]!.scheduled_days);
			expect(chain[i]!.reps).toBe(i + 1);
		}
	});

	it('counts a lapse when a reviewed card is rated again', () => {
		const prev = reviewFsrs(null, NOW, 'good').result;
		const lapsed = reviewFsrs(prev, prev.due, 'again').result;
		expect(lapsed.lapses).toBe(prev.lapses + 1);
		expect(lapsed.stability).toBeLessThan(prev.stability);
	});

	it('does not count a lapse for good or hard', () => {
		const prev = reviewFsrs(null, NOW, 'good').result;
		expect(reviewFsrs(prev, prev.due, 'good').result.lapses).toBe(prev.lapses);
		expect(reviewFsrs(prev, prev.due, 'hard').result.lapses).toBe(prev.lapses);
	});

	it('never schedules beyond maximumIntervalDays', () => {
		const maximumIntervalDays = 5;
		const config: FsrsConfig = { retention: RETENTION, maximumIntervalDays };
		for (const state of goodChain(6, config)) {
			expect(state.scheduled_days).toBeLessThanOrEqual(maximumIntervalDays);
			expect(state.due - (state.last_review ?? 0)).toBeLessThanOrEqual(
				maximumIntervalDays * MS_PER_DAY
			);
		}
	});

	it('uses the default config (RETENTION, FSRS_MAXIMUM_INTERVAL_DAYS) when none is given', () => {
		expect(DEFAULT_FSRS_CONFIG.retention).toBe(RETENTION);
		expect(DEFAULT_FSRS_CONFIG.maximumIntervalDays).toBe(FSRS_MAXIMUM_INTERVAL_DAYS);
		const prev = reviewFsrs(null, NOW, 'good').result;
		expect(reviewFsrs(prev, prev.due, 'good')).toStrictEqual(
			reviewFsrs(prev, prev.due, 'good', DEFAULT_FSRS_CONFIG)
		);
	});

	it('gives a higher target retention an interval no longer than a lower one', () => {
		const high: FsrsConfig = { ...DEFAULT_FSRS_CONFIG, retention: RETENTION_MAX };
		const low: FsrsConfig = { ...DEFAULT_FSRS_CONFIG, retention: RETENTION_MIN };
		const prev = reviewFsrs(null, NOW, 'good').result;
		const atHigh = reviewFsrs(prev, prev.due, 'good', high).result;
		const atLow = reviewFsrs(prev, prev.due, 'good', low).result;
		expect(atHigh.scheduled_days).toBeLessThanOrEqual(atLow.scheduled_days);
	});

	it('returns a valid state after a lapse, a hard and a good in a row', () => {
		let state = reviewFsrs(null, NOW, 'good').result;
		for (const rating of ['again', 'hard', 'good'] as const) {
			state = reviewFsrs(state, state.due, rating).result;
			expect(FsrsCardStateSchema.safeParse(state).success).toBe(true);
		}
	});
});

describe('capStability (Decisions log: massed modes and fragile)', () => {
	it('caps stability at the bound', () => {
		const capped = capStability(stateWith({ stability: 10, scheduled_days: 10 }), FRAGILE_CAP_DAYS);
		expect(capped.stability).toBe(FRAGILE_CAP_DAYS);
	});

	it('shortens scheduled_days to the bound and moves due to match', () => {
		const state = stateWith({ stability: 10, scheduled_days: 10 });
		const capped = capStability(state, FRAGILE_CAP_DAYS);
		expect(capped.scheduled_days).toBeLessThanOrEqual(FRAGILE_CAP_DAYS);
		expect(capped.scheduled_days).toBeLessThan(state.scheduled_days);
		// SPEC-GAP: "shortening the scheduled interval and due to match" — read as
		// due = last_review + scheduled_days days, and never later than last_review + bound days.
		expect(capped.due).toBe(NOW + capped.scheduled_days * MS_PER_DAY);
		expect(capped.due).toBeLessThanOrEqual(NOW + FRAGILE_CAP_DAYS * MS_PER_DAY);
	});

	it('leaves every other field untouched', () => {
		const state = stateWith({ stability: 10, scheduled_days: 10 });
		const { stability, scheduled_days, due, ...rest } = capStability(state, FRAGILE_CAP_DAYS);
		void stability;
		void scheduled_days;
		void due;
		const { stability: s, scheduled_days: d, due: u, ...expected } = state;
		void s;
		void d;
		void u;
		expect(rest).toStrictEqual(expected);
	});

	it('returns a state already within the bound unchanged', () => {
		const state = stateWith({ stability: 1.5, scheduled_days: 1 });
		expect(capStability(state, FRAGILE_CAP_DAYS)).toStrictEqual(state);
	});

	it('returns a state exactly at the bound unchanged', () => {
		const state = stateWith({ stability: FRAGILE_CAP_DAYS, scheduled_days: FRAGILE_CAP_DAYS });
		expect(capStability(state, FRAGILE_CAP_DAYS)).toStrictEqual(state);
	});

	it('respects a bound above FRAGILE_CAP_DAYS (a card already more stable)', () => {
		const bound = 20;
		const capped = capStability(stateWith({ stability: 40, scheduled_days: 40 }), bound);
		expect(capped.stability).toBe(bound);
		expect(capped.scheduled_days).toBeLessThanOrEqual(bound);
	});

	it('returns a valid FsrsCardState and does not mutate its input', () => {
		const state = deepFreeze(stateWith({ stability: 10, scheduled_days: 10 }));
		const copy = structuredClone(state);
		const capped = capStability(state, FRAGILE_CAP_DAYS);
		expect(FsrsCardStateSchema.safeParse(capped).success).toBe(true);
		expect(state).toStrictEqual(copy);
	});

	it('caps a real good review of a new card at FRAGILE_CAP_DAYS', () => {
		const reviewed = reviewFsrs(null, NOW, 'good').result;
		const capped = capStability(reviewed, FRAGILE_CAP_DAYS);
		expect(capped.stability).toBeLessThanOrEqual(FRAGILE_CAP_DAYS);
		expect(capped.due - NOW).toBeLessThanOrEqual(FRAGILE_CAP_DAYS * MS_PER_DAY);
	});
});

describe('retrievabilityAt (§6.2)', () => {
	it('gives 0 for a card with no FSRS state', () => {
		expect(retrievabilityAt(null, NOW)).toBe(0);
	});

	it('is 1, or very close, at the moment of review', () => {
		const state = reviewFsrs(null, NOW, 'good').result;
		const r = retrievabilityAt(state, NOW);
		expect(r).toBeGreaterThanOrEqual(0.99);
		expect(r).toBeLessThanOrEqual(1);
	});

	it('decreases strictly as time passes, staying in (0, 1]', () => {
		const state = reviewFsrs(null, NOW, 'good').result;
		const times = [1, 2, 5, LATER_DAYS].map((d) => NOW + d * MS_PER_DAY);
		const values = times.map((t) => retrievabilityAt(state, t));
		for (let i = 0; i < values.length; i += 1) {
			expect(values[i]).toBeGreaterThan(0);
			expect(values[i]).toBeLessThanOrEqual(1);
			if (i > 0) expect(values[i]).toBeLessThan(values[i - 1]!);
		}
	});

	it('is about 90% one stability-length after the review (FSRS definition of stability)', () => {
		const state = stateWith({ stability: 10, scheduled_days: 10 });
		const r = retrievabilityAt(state, NOW + state.stability * MS_PER_DAY);
		expect(r).toBeCloseTo(FSRS_STABILITY_RECALL, 2);
	});

	it('is higher for a more stable card at the same time', () => {
		const t = NOW + LATER_DAYS * MS_PER_DAY;
		const weak = retrievabilityAt(stateWith({ stability: 3, scheduled_days: 3 }), t);
		const strong = retrievabilityAt(stateWith({ stability: 60, scheduled_days: 60 }), t);
		expect(strong).toBeGreaterThan(weak);
	});

	it('is deterministic', () => {
		const state = reviewFsrs(null, NOW, 'hard').result;
		const t = NOW + 3 * MS_PER_DAY;
		expect(retrievabilityAt(state, t)).toBe(retrievabilityAt(state, t));
	});
});
