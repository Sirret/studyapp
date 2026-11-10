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

/** The first millisecond of a study day (`DAY_ROLLOVER_HOUR` local time on that day). */
export function startOfStudyDay(day: number, tzOffsetMin: number): number {
	return day * MS_PER_DAY + DAY_ROLLOVER_HOUR * MS_PER_HOUR - tzOffsetMin * MS_PER_MINUTE;
}

/** Days from Monday of 1970-01-01's week: that date was a Thursday. */
const EPOCH_WEEKDAY_MON0 = 3;
const DAYS_PER_WEEK = 7;
const MINUTES_PER_HOUR = 60;

/** The weekday of a study day, 0 = Monday … 6 = Sunday (`Availability.weekdayMinutes` order). */
export function weekdayOf(day: number): number {
	return (((day + EPOCH_WEEKDAY_MON0) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
}

/** The study day of a local calendar date (`YYYY-MM-DD`). */
export function dayOfLocalDate(date: string): number {
	return Math.floor(Date.parse(`${date}T00:00:00Z`) / MS_PER_DAY);
}

/** The local calendar date (`YYYY-MM-DD`) a study day starts on. */
export function localDateOf(day: number): string {
	return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Minutes after local midnight of an `HH:mm` time. */
export function minutesOfTime(time: string): number {
	const [hours = 0, minutes = 0] = time.split(':').map(Number);
	return hours * MINUTES_PER_HOUR + minutes;
}

/** The epoch ms of a local date and `HH:mm` time. */
export function localDateTime(date: string, time: string, tzOffsetMin: number): number {
	return dayOfLocalDate(date) * MS_PER_DAY + (minutesOfTime(time) - tzOffsetMin) * MS_PER_MINUTE;
}
