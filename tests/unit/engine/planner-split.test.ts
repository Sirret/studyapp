import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BLOCK_MIN, DAILY_FLOOR_MIN } from '#lib/config/defaults.ts';
import type { CourseId } from '#lib/db/schemas/common.ts';
import { dailySplit, type DaySplit } from '#lib/engine/planner-split.ts';
import { courseId, NUM_RUNS } from './fixtures.ts';
import { reorder } from './planner-fixtures.ts';

/** @see BUILD_PLAN §6.9 ("Daily split", "The planner, concretely" → Daily split), CONCEPT §10 */

interface SplitCourse {
	courseId: CourseId;
	examDay: number;
	workMinutes: number;
}

const c = (n: number, examDay: number, workMinutes: number): SplitCourse => ({
	courseId: courseId(n),
	examDay,
	workMinutes
});

const given = (day: DaySplit): number =>
	Object.values(day.minutes).reduce((s: number, m) => s + (m ?? 0), 0);

describe('dailySplit: days', () => {
	it('covers today to the day before the last exam', () => {
		const { result } = dailySplit({
			courses: [c(1, 12, 30), c(2, 15, 30)],
			today: 10,
			dayMinutes: [60, 60, 60, 60, 60]
		});
		expect(result.map((d) => d.day)).toEqual([10, 11, 12, 13, 14]);
	});

	// SPEC-GAP: with no course, or only exams today, "today .. last exam − 1" is empty; read as [].
	it('is empty when there are no courses or the only exam is today', () => {
		expect(dailySplit({ courses: [], today: 0, dayMinutes: [60] }).result).toEqual([]);
		expect(dailySplit({ courses: [c(1, 0, 50)], today: 0, dayMinutes: [60] }).result).toEqual([]);
	});

	it('indexes dayMinutes from today, floors them, and counts a missing day as 0', () => {
		const { result } = dailySplit({ courses: [c(1, 103, 1000)], today: 100, dayMinutes: [25.9] });
		expect(result).toHaveLength(3);
		expect(result[0]!.minutes[courseId(1)]).toBe(25);
		expect(result[0]!.freeMinutes).toBe(0);
		expect(result[1]).toEqual({ day: 101, minutes: {}, freeMinutes: 0 });
		expect(result[2]).toEqual({ day: 102, minutes: {}, freeMinutes: 0 });
	});
});

describe('dailySplit: floor and blocks', () => {
	it('gives every active course a floor of DAILY_FLOOR_MIN when the cap allows', () => {
		// Three courses, plenty of work, cap 6 floors' worth: each gets at least its floor.
		const cap = 6 * DAILY_FLOOR_MIN;
		const { result } = dailySplit({
			courses: [c(1, 1, 1000), c(2, 5, 1000), c(3, 6, 1000)],
			today: 0,
			dayMinutes: [cap]
		});
		const day0 = result[0]!;
		for (const n of [1, 2, 3]) {
			expect(day0.minutes[courseId(n)]).toBeGreaterThanOrEqual(DAILY_FLOOR_MIN);
		}
		expect(given(day0)).toBe(cap);
	});

	it('shrinks the floor to floor(cap / |active|) on a short day', () => {
		// cap 20, three courses: floor 6 each, the 2 left go as one block to the least laxity.
		const { result } = dailySplit({
			courses: [c(1, 1, 1000), c(2, 4, 1000), c(3, 4, 1000)],
			today: 0,
			dayMinutes: [20, 0, 0, 0]
		});
		const day0 = result[0]!;
		expect(day0.minutes[courseId(1)]).toBe(8);
		expect(day0.minutes[courseId(2)]).toBe(6);
		expect(day0.minutes[courseId(3)]).toBe(6);
		expect(day0.freeMinutes).toBe(0);
	});

	it('never gives a floor bigger than the course has left', () => {
		const { result } = dailySplit({
			courses: [c(1, 3, 3), c(2, 3, 1000)],
			today: 0,
			dayMinutes: [100, 100, 100]
		});
		expect(result[0]!.minutes[courseId(1)]).toBe(3);
		expect(result[0]!.minutes[courseId(2)]).toBe(97);
		expect(result[1]!.minutes[courseId(1)]).toBeUndefined();
	});

	it('gives the blocks to the course with the least laxity', () => {
		// Day 0 cap 60: floors 10 + 10, then A (exam tomorrow, laxity −50) takes every block
		// while B (four more days ahead) keeps a laxity far above it.
		const { result } = dailySplit({
			courses: [c(1, 1, 100), c(2, 5, 100)],
			today: 0,
			dayMinutes: [60, 60, 60, 60, 60]
		});
		expect(result[0]!.minutes).toEqual({ [courseId(1)]: 50, [courseId(2)]: 10 });
		expect(result[1]!.minutes).toEqual({ [courseId(2)]: 60 });
		expect(result[2]!.minutes).toEqual({ [courseId(2)]: 30 });
		expect(result[2]!.freeMinutes).toBe(30);
		expect(result[3]).toEqual({ day: 3, minutes: {}, freeMinutes: 60 });
	});

	it('laxity counts only the caps of the days before each exam', () => {
		// Same work, but B's exam is far off with time ahead: A is the urgent one even though
		// it was listed second.
		const { result } = dailySplit({
			courses: [c(2, 4, 90), c(1, 2, 90)],
			today: 0,
			dayMinutes: [40, 40, 40, 40]
		});
		expect(result[0]!.minutes[courseId(1)]).toBe(30);
		expect(result[0]!.minutes[courseId(2)]).toBe(10);
	});

	it('a block is at most BLOCK_MIN, the cap left and the course remaining', () => {
		const { result } = dailySplit({ courses: [c(1, 2, 25)], today: 0, dayMinutes: [60, 60] });
		// floor 10, then blocks of BLOCK_MIN and the 5 left
		expect(DAILY_FLOOR_MIN + BLOCK_MIN).toBeLessThan(25);
		expect(result[0]!.minutes[courseId(1)]).toBe(25);
		expect(result[0]!.freeMinutes).toBe(35);
		expect(result[1]).toEqual({ day: 1, minutes: {}, freeMinutes: 60 });
	});

	it('breaks laxity ties to the earlier exam', () => {
		// Later days have no time, so laxities tie; cap 30 = two floors + one block.
		const { result } = dailySplit({
			courses: [c(1, 3, 100), c(2, 2, 100)],
			today: 0,
			dayMinutes: [30, 0, 0]
		});
		expect(result[0]!.minutes).toEqual({ [courseId(2)]: 20, [courseId(1)]: 10 });
	});

	it('breaks laxity ties on the same exam day by course ID', () => {
		const { result } = dailySplit({
			courses: [c(2, 1, 100), c(1, 1, 100)],
			today: 0,
			dayMinutes: [30]
		});
		expect(result[0]!.minutes).toEqual({ [courseId(1)]: 20, [courseId(2)]: 10 });
	});
});

describe('dailySplit: who is active', () => {
	it('gives nothing to a course on or after its exam day', () => {
		const { result } = dailySplit({
			courses: [c(1, 1, 500), c(2, 3, 500)],
			today: 0,
			dayMinutes: [50, 50, 50]
		});
		expect(result[1]!.minutes[courseId(1)]).toBeUndefined();
		expect(result[2]!.minutes[courseId(1)]).toBeUndefined();
		expect(result[1]!.minutes[courseId(2)]).toBe(50);
	});

	it('leaves a course with no work out, and frees the whole day', () => {
		const { result } = dailySplit({ courses: [c(1, 2, 0)], today: 0, dayMinutes: [45, 45] });
		expect(result).toEqual([
			{ day: 0, minutes: {}, freeMinutes: 45 },
			{ day: 1, minutes: {}, freeMinutes: 45 }
		]);
	});

	it('carries remaining work over to the next day', () => {
		const { result } = dailySplit({
			courses: [c(1, 5, 25)],
			today: 0,
			dayMinutes: [10, 10, 10, 10, 10]
		});
		expect(result.map((d) => d.minutes[courseId(1)])).toEqual([10, 10, 5, undefined, undefined]);
		expect(result.map((d) => d.freeMinutes)).toEqual([0, 0, 5, 10, 10]);
	});
});

const splitArb = fc.record({
	today: fc.integer({ min: 0, max: 400 }),
	courses: fc.array(
		fc.record({
			offset: fc.integer({ min: 0, max: 7 }),
			work: fc.integer({ min: 0, max: 400 })
		}),
		{ maxLength: 5 }
	),
	dayMinutes: fc.array(
		fc.oneof(
			fc.integer({ min: 0, max: 180 }),
			fc.double({ min: 0, max: 180, noNaN: true }).map(Math.abs)
		),
		{
			maxLength: 8
		}
	)
});

type RawSplit = typeof splitArb extends fc.Arbitrary<infer T> ? T : never;

function build(raw: RawSplit) {
	return {
		today: raw.today,
		dayMinutes: raw.dayMinutes,
		courses: raw.courses.map((r, i) => c(i + 1, raw.today + r.offset, r.work))
	};
}

describe('dailySplit: properties', () => {
	it('never starves an active course when the cap is at least one minute per active course', () => {
		fc.assert(
			fc.property(splitArb, (raw) => {
				const input = build(raw);
				const left = new Map(input.courses.map((x) => [x.courseId, x.workMinutes]));
				for (const day of dailySplit(input).result) {
					const cap = Math.floor(input.dayMinutes[day.day - input.today] ?? 0);
					const active = input.courses.filter(
						(x) => x.examDay > day.day && left.get(x.courseId)! > 0
					);
					// SPEC-GAP: with 0 < cap < |active|, floor(cap / |active|) = 0 and some course
					// must get nothing; "never starved" is only asserted when cap ≥ |active|.
					if (cap >= active.length) {
						for (const x of active) expect(day.minutes[x.courseId] ?? 0).toBeGreaterThan(0);
					}
					for (const [id, m] of Object.entries(day.minutes)) {
						left.set(id as CourseId, left.get(id as CourseId)! - (m ?? 0));
					}
				}
			}),
			{ numRuns: NUM_RUNS }
		);
	});

	it('keeps each day within its cap, freeMinutes = cap − given, and uses the cap while work is left', () => {
		fc.assert(
			fc.property(splitArb, (raw) => {
				const input = build(raw);
				const left = new Map(input.courses.map((x) => [x.courseId, x.workMinutes]));
				const result = dailySplit(input).result;
				const last = Math.max(...input.courses.map((x) => x.examDay), input.today);
				expect(result.map((d) => d.day)).toEqual(
					Array.from({ length: last - input.today }, (_, i) => input.today + i)
				);
				for (const day of result) {
					const cap = Math.floor(input.dayMinutes[day.day - input.today] ?? 0);
					const sum = given(day);
					expect(sum).toBeLessThanOrEqual(cap);
					expect(day.freeMinutes).toBe(cap - sum);
					for (const [id, m] of Object.entries(day.minutes)) {
						const x = input.courses.find((y) => y.courseId === id)!;
						expect(Number.isInteger(m)).toBe(true);
						expect(m).toBeGreaterThan(0);
						expect(x.examDay).toBeGreaterThan(day.day);
						left.set(x.courseId, left.get(x.courseId)! - m!);
					}
					if (day.freeMinutes > 0) {
						for (const x of input.courses) {
							if (x.examDay > day.day) expect(left.get(x.courseId)).toBe(0);
						}
					}
				}
				for (const v of left.values()) expect(v).toBeGreaterThanOrEqual(0);
			}),
			{ numRuns: NUM_RUNS }
		);
	});

	it('is deterministic (trace included) and independent of course order', () => {
		fc.assert(
			fc.property(splitArb, (raw) => {
				const input = build(raw);
				const a = dailySplit(input);
				expect(dailySplit(build(raw))).toEqual(a);
				expect(dailySplit({ ...input, courses: reorder(input.courses) }).result).toEqual(a.result);
			}),
			{ numRuns: NUM_RUNS }
		);
	});
});
