/**
 * Study days. A day runs from `DAY_ROLLOVER_HOUR` local time to the same hour the next day, so
 * late-night study counts for the day before. The local zone is passed in as `tzOffsetMin`
 * (minutes east of UTC); the engine never reads the device's clock or zone.
 *
 * @see BUILD_PLAN §6.1 and Decisions log (time-zone offset)
 */

/** The study day a timestamp falls in, as a whole number that grows by one per day. */
export function dayIndex(ts: number, tzOffsetMin: number): number {
	void ts;
	void tzOffsetMin;
	throw new Error('not implemented');
}

/** Study days from `a` to `b`: positive when `b` is on a later day. */
export function daysBetween(a: number, b: number, tzOffsetMin: number): number {
	void a;
	void b;
	void tzOffsetMin;
	throw new Error('not implemented');
}

/** Whether two timestamps fall in the same study day. */
export function isSameStudyDay(a: number, b: number, tzOffsetMin: number): boolean {
	void a;
	void b;
	void tzOffsetMin;
	throw new Error('not implemented');
}
