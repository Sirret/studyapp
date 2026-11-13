import { describe, expect, it } from 'vitest';
import { PRIORITY_WEIGHT } from '#lib/config/defaults.ts';
import { valueOf, valuePerMinute } from '#lib/engine/value.ts';

/**
 * One value formula for cram's degrade order, the planner's cuts and one-night triage.
 *
 * @see BUILD_PLAN §6.6 (degrade), §6.8 (one-night), §6.9 (cuts); SESSION_NOTES A6
 */

const RETENTION = 0.9;

describe('valueOf', () => {
	it('is PRIORITY_WEIGHT × max(0, retention − R_exam) for one card', () => {
		expect(valueOf({ priority: 'normal', rExam: 0.4 }, RETENTION)).toBeCloseTo(0.5, 9);
		expect(valueOf({ priority: 'high', rExam: 0.4 }, RETENTION)).toBeCloseTo(
			PRIORITY_WEIGHT.high * 0.5,
			9
		);
	});

	it('is never negative when R_exam is above the target retention', () => {
		expect(valueOf({ priority: 'high', rExam: 0.97 }, RETENTION)).toBe(0);
	});

	it('scales with the number of cards (a unit of new cards has R_exam = 0)', () => {
		expect(valueOf({ priority: 'normal', rExam: 0, cards: 4 }, RETENTION)).toBeCloseTo(
			4 * RETENTION,
			9
		);
	});

	it('defaults to one card', () => {
		expect(valueOf({ priority: 'normal', rExam: 0 }, RETENTION)).toBe(
			valueOf({ priority: 'normal', rExam: 0, cards: 1 }, RETENTION)
		);
	});
});

describe('valuePerMinute', () => {
	it('divides the value by the minutes', () => {
		expect(valuePerMinute({ priority: 'normal', rExam: 0 }, RETENTION, 3)).toBeCloseTo(0.3, 9);
	});

	it('ranks zero-minute work above any timed work, and stays finite for sorting', () => {
		const free = valuePerMinute({ priority: 'normal', rExam: 0 }, RETENTION, 0);
		expect(Number.isFinite(free)).toBe(true);
		expect(free).toBeGreaterThan(valuePerMinute({ priority: 'high', rExam: 0 }, RETENTION, 0.01));
		expect(free - free).toBe(0);
	});

	it('is 0 for worthless work, even in zero minutes', () => {
		expect(valuePerMinute({ priority: 'normal', rExam: 1 }, RETENTION, 0)).toBe(0);
	});
});
