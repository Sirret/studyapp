import { describe, expect, it } from 'vitest';
import { DAY_ROLLOVER_HOUR } from '#lib/config/defaults.ts';
import { dayIndex, daysBetween, isSameStudyDay, MS_PER_DAY } from '#lib/engine/time.ts';

const HOUR = 3_600_000;
/** 2026-03-10 00:00 UTC. */
const MIDNIGHT_UTC = Date.UTC(2026, 2, 10);
const ROLLOVER_UTC = MIDNIGHT_UTC + DAY_ROLLOVER_HOUR * HOUR;

describe('dayIndex', () => {
	it('starts a new study day at DAY_ROLLOVER_HOUR, not midnight', () => {
		expect(dayIndex(ROLLOVER_UTC - 1, 0)).toBe(dayIndex(ROLLOVER_UTC - 5 * HOUR, 0));
		expect(dayIndex(ROLLOVER_UTC, 0)).toBe(dayIndex(ROLLOVER_UTC - 1, 0) + 1);
	});

	it('counts 1 a.m. study for the previous day', () => {
		const lateEvening = MIDNIGHT_UTC - 2 * HOUR;
		expect(dayIndex(MIDNIGHT_UTC + HOUR, 0)).toBe(dayIndex(lateEvening, 0));
	});

	it('grows by one per day', () => {
		expect(dayIndex(ROLLOVER_UTC + MS_PER_DAY, 0)).toBe(dayIndex(ROLLOVER_UTC, 0) + 1);
	});

	it('uses the offset passed in: 04:00 local in UTC+2 is 02:00 UTC', () => {
		const offset = 120;
		const localRollover = ROLLOVER_UTC - 2 * HOUR;
		expect(dayIndex(localRollover, offset)).toBe(dayIndex(localRollover - 1, offset) + 1);
	});

	it('handles a negative offset (west of UTC)', () => {
		const offset = -300;
		const localRollover = ROLLOVER_UTC + 5 * HOUR;
		expect(dayIndex(localRollover, offset)).toBe(dayIndex(localRollover - 1, offset) + 1);
	});
});

describe('daysBetween and isSameStudyDay', () => {
	it('is 0 within a study day and across midnight', () => {
		expect(daysBetween(ROLLOVER_UTC, ROLLOVER_UTC + 23 * HOUR, 0)).toBe(0);
		expect(isSameStudyDay(MIDNIGHT_UTC - HOUR, MIDNIGHT_UTC + HOUR, 0)).toBe(true);
	});

	it('is signed: positive when b is later, negative when earlier', () => {
		expect(daysBetween(ROLLOVER_UTC, ROLLOVER_UTC + 3 * MS_PER_DAY, 0)).toBe(3);
		expect(daysBetween(ROLLOVER_UTC + 3 * MS_PER_DAY, ROLLOVER_UTC, 0)).toBe(-3);
	});

	it('counts one day across the rollover even a minute apart', () => {
		expect(daysBetween(ROLLOVER_UTC - 60_000, ROLLOVER_UTC, 0)).toBe(1);
		expect(isSameStudyDay(ROLLOVER_UTC - 60_000, ROLLOVER_UTC, 0)).toBe(false);
	});
});
