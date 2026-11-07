import { DAY_ROLLOVER_HOUR } from '#lib/config/defaults.ts';

/**
 * Study days. A day runs from `DAY_ROLLOVER_HOUR` local time to the same hour the next day, so
 * late-night study counts for the day before. The local zone is passed in as `tzOffsetMin`
 * (minutes east of UTC); the engine never reads the device's clock or zone.
 *
 * @see BUILD_PLAN §6.1 and Decisions log (time-zone offset)
 */

/** Milliseconds in a minute. */
export const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
/** Milliseconds in a day, for converting FSRS day counts to timestamps. */
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/** The study day a timestamp falls in, as a whole number that grows by one per day. */
export function dayIndex(ts: number, tzOffsetMin: number): number {
	const local = ts + tzOffsetMin * MS_PER_MINUTE - DAY_ROLLOVER_HOUR * MS_PER_HOUR;
	return Math.floor(local / MS_PER_DAY);
}

/** Study days from `a` to `b`: positive when `b` is on a later day. */
export function daysBetween(a: number, b: number, tzOffsetMin: number): number {
	return dayIndex(b, tzOffsetMin) - dayIndex(a, tzOffsetMin);
}

/** Whether two timestamps fall in the same study day. */
export function isSameStudyDay(a: number, b: number, tzOffsetMin: number): boolean {
	return daysBetween(a, b, tzOffsetMin) === 0;
}
