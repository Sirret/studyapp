import type { FsrsCardState } from '#lib/db/schemas/card.ts';
import { ExerciseKindSchema, type ExerciseKind } from '#lib/db/schemas/common.ts';
import type { CramCard, CramPlanInput, SleepWindow } from '#lib/engine/cram.ts';
import { EMPTY_CALIBRATION, type Calibration } from '#lib/engine/estimate.ts';
import { DEFAULT_FSRS_CONFIG, reviewFsrs } from '#lib/engine/fsrs.ts';
import { MS_PER_DAY, MS_PER_MINUTE } from '#lib/engine/time.ts';
import { cardId } from './fixtures.ts';

/** Shared builders for the cram unit tests and the cram-plans simulation. @see BUILD_PLAN §6.6 */

const MS_PER_HOUR = 60 * MS_PER_MINUTE;
/** Tue 1 Sep 2026, 12:00 UTC: when every plan is made. */
export const NOW = Date.UTC(2026, 8, 1, 12);
/** The exam on day `d` (0 = today) at 09:00 UTC. */
export const examAtFor = (d: number): number => NOW + d * MS_PER_DAY - 3 * MS_PER_HOUR;

/** 23:00–07:00: crosses midnight. */
export const SLEEP_CROSSING: SleepWindow = { startMin: 23 * 60, endMin: 7 * 60 };
/** 00:30–08:30: does not cross midnight. */
export const SLEEP_AFTER_MIDNIGHT: SleepWindow = { startMin: 30, endMin: 8 * 60 + 30 };
export const MINUTES_PER_DAY = 24 * 60;

/** Sleep length in minutes. */
export function sleepLength(sleep: SleepWindow): number {
	return (sleep.endMin - sleep.startMin + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Whether minute-of-day `m` lies inside the sleep window. */
export function inSleep(m: number, sleep: SleepWindow): boolean {
	const t = ((m % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
	return sleep.startMin > sleep.endMin
		? t >= sleep.startMin || t < sleep.endMin
		: t >= sleep.startMin && t < sleep.endMin;
}

/** An FSRS state after one `good` review at each of the given days relative to NOW. */
export function stateFrom(days: readonly number[]): FsrsCardState {
	let state: FsrsCardState | null = null;
	for (const d of days) state = reviewFsrs(state, NOW + d * MS_PER_DAY, 'good').result;
	if (!state) throw new Error('stateFrom needs at least one review');
	return state;
}

/** Reviewed once three days ago: stability ≈ 2 days, well below SECURE_AT_EXAM by any exam. */
export const AT_RISK = stateFrom([-3]);
/** Two reviews a month ago: interval ≥ 7 days, but R at a week-away exam below SECURE_AT_EXAM. */
export const AT_RISK_LONG = stateFrom([-30, -20]);
/** Years of spaced reviews: R stays above SECURE_AT_EXAM for any exam within a week. */
export const SECURE = stateFrom([-400, -397, -385, -350, -250, -60]);
/** One review long ago: R at NOW is below every default p0. */
export const FORGOTTEN = stateFrom([-400]);

export function cramCard(n: number, overrides: Partial<CramCard> = {}): CramCard {
	return {
		id: cardId(n),
		kind: 'cloze',
		noteType: 'cloze',
		fsrs: null,
		weak: false,
		priority: 'normal',
		...overrides
	};
}

/** The same seconds per attempt for every kind, so costs don't depend on which kind is used. */
export function uniformCalibration(seconds: number): Calibration {
	const secPerAttempt: Partial<Record<ExerciseKind, number>> = {};
	for (const kind of ExerciseKindSchema.options) secPerAttempt[kind] = seconds;
	return { ...EMPTY_CALIBRATION, secPerAttempt };
}

/** A one-minute attempt for every kind. */
export const MINUTE_PER_ATTEMPT = uniformCalibration(60);

/** A plan input for an exam `d` days away, with generous time unless overridden. */
export function planInput(
	d: number,
	cards: readonly CramCard[],
	overrides: Partial<CramPlanInput> = {}
): CramPlanInput {
	return {
		cards,
		daysToExam: d,
		examFormat: 'recall',
		examAt: examAtFor(d),
		now: NOW,
		dayMinutes: Array.from({ length: d }, () => 600),
		examMorningMinutes: 30,
		sleep: SLEEP_CROSSING,
		calibration: MINUTE_PER_ATTEMPT,
		fsrs: DEFAULT_FSRS_CONFIG,
		...overrides
	};
}

/** A small mixed deck: at-risk (one weak), secure, and new cards of both priorities. */
export function mixedDeck(): CramCard[] {
	return [
		cramCard(1, { fsrs: AT_RISK }),
		cramCard(2, { fsrs: AT_RISK_LONG }),
		cramCard(3, { fsrs: AT_RISK, weak: true }),
		cramCard(4, { fsrs: SECURE }),
		cramCard(5, { fsrs: SECURE, noteType: 'keyterm', kind: 'mc' }),
		cramCard(6, { priority: 'high', noteType: 'keyterm' }),
		cramCard(7),
		cramCard(8, { noteType: 'sequence', kind: 'sequence' }),
		cramCard(9, { priority: 'high' })
	];
}
