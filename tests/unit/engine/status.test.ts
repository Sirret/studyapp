import { describe, expect, it } from 'vitest';
import { SECURE_STABILITY_DAYS } from '#lib/config/defaults.ts';
import type { CardStatus } from '#lib/db/schemas/common.ts';
import {
	deriveStatus,
	EMPTY_DAY_TALLY,
	tallyDay,
	type DayTally,
	type StatusFacts
} from '#lib/engine/status.ts';
import { deepFreeze } from './fixtures.ts';

const D = 20_000; // an arbitrary study-day number

/** Folds answers into a fresh tally. */
function tally(...answers: readonly [day: number, correct: boolean][]): DayTally {
	return answers.reduce<DayTally>(
		(acc, [day, correct]) => tallyDay(acc, { day, correct }),
		EMPTY_DAY_TALLY
	);
}

/** A card studied normally with one correct day: provisional unless overridden. */
function facts(overrides: Partial<StatusFacts> = {}): StatusFacts {
	return {
		reviewed: true,
		counted: true,
		onlyOneNight: false,
		daysCorrect: 1,
		lastCorrect: true,
		stability: 1,
		fragile: false,
		cramCriterionMet: false,
		...overrides
	};
}

const status = (overrides: Partial<StatusFacts> = {}): CardStatus =>
	deriveStatus(facts(overrides)).result;

describe('tallyDay (§6.5, Decisions log: daysCorrect and lapses)', () => {
	it('starts empty', () => {
		expect(EMPTY_DAY_TALLY).toStrictEqual({
			firstDay: null,
			seenDays: [],
			countedDays: [],
			lapseDay: null
		});
	});

	it('records the first counting day and counts a correct on it', () => {
		expect(tally([D, true])).toStrictEqual({
			firstDay: D,
			seenDays: [D],
			countedDays: [D],
			lapseDay: null
		});
	});

	it('does not treat a wrong answer on the first day as a lapse', () => {
		expect(tally([D, false])).toStrictEqual({
			firstDay: D,
			seenDays: [D],
			countedDays: [],
			lapseDay: null
		});
	});

	it('counts the first day once a correct follows a wrong on that day', () => {
		const t = tally([D, false], [D, true]);
		expect(t.countedDays).toStrictEqual([D]);
		expect(t.lapseDay).toBeNull();
	});

	it('counts a day once however many corrects it has', () => {
		const t = tally([D, true], [D, true], [D, true]);
		expect(t.countedDays).toStrictEqual([D]);
		expect(t.seenDays).toStrictEqual([D]);
	});

	it('counts distinct correct days in ascending order, gaps included', () => {
		const t = tally([D, true], [D + 1, true], [D + 4, true]);
		expect(t.countedDays).toStrictEqual([D, D + 1, D + 4]);
		expect(t.seenDays).toStrictEqual([D, D + 1, D + 4]);
		expect(t.firstDay).toBe(D);
	});

	it('makes a wrong first counting event of a later day a lapse that clears countedDays', () => {
		const t = tally([D, true], [D + 1, true], [D + 2, false]);
		expect(t.lapseDay).toBe(D + 2);
		expect(t.countedDays).toStrictEqual([]);
		expect(t.seenDays).toStrictEqual([D, D + 1, D + 2]);
	});

	it('does not let the lapse day count, even after a correct that day', () => {
		const t = tally([D, true], [D + 1, false], [D + 1, true], [D + 1, true]);
		expect(t.lapseDay).toBe(D + 1);
		expect(t.countedDays).toStrictEqual([]);
	});

	it('counts days after the lapse day again', () => {
		const t = tally([D, true], [D + 1, false], [D + 1, true], [D + 2, true], [D + 3, true]);
		expect(t.countedDays).toStrictEqual([D + 2, D + 3]);
	});

	it('does not lapse on a wrong that is not the first counting event of its day', () => {
		const t = tally([D, true], [D + 1, true], [D + 1, false]);
		expect(t.lapseDay).toBeNull();
		expect(t.countedDays).toStrictEqual([D, D + 1]);
	});

	it('does not lapse on a later wrong on the first day', () => {
		const t = tally([D, true], [D, false]);
		expect(t.lapseDay).toBeNull();
		expect(t.countedDays).toStrictEqual([D]);
	});

	it('lapses on a later day even when no day has counted yet', () => {
		const t = tally([D, false], [D + 1, false]);
		expect(t.lapseDay).toBe(D + 1);
		expect(t.countedDays).toStrictEqual([]);
	});

	it('moves lapseDay to the latest lapse', () => {
		const t = tally([D, true], [D + 1, false], [D + 2, true], [D + 3, false], [D + 4, true]);
		expect(t.lapseDay).toBe(D + 3);
		expect(t.countedDays).toStrictEqual([D + 4]);
	});

	it('does not mutate its input tally', () => {
		const base = deepFreeze(tally([D, true]));
		const copy = structuredClone(base);
		tallyDay(base, { day: D + 1, correct: true });
		tallyDay(base, { day: D + 1, correct: false });
		tallyDay(deepFreeze(EMPTY_DAY_TALLY), { day: D, correct: true });
		expect(base).toStrictEqual(copy);
	});
});

describe('deriveStatus (§6.5, CONCEPT §7, Decisions log: status precedence)', () => {
	it('is unseen with no review events', () => {
		expect(status({ reviewed: false, counted: false, daysCorrect: 0, stability: null })).toBe(
			'unseen'
		);
	});

	it('puts unseen first, whatever else the facts say', () => {
		expect(status({ reviewed: false })).toBe('unseen');
	});

	it('is learning when reviewed but nothing counted yet', () => {
		expect(status({ counted: false, daysCorrect: 0, stability: null, lastCorrect: false })).toBe(
			'learning'
		);
	});

	it('puts learning before every later rule', () => {
		expect(status({ counted: false, daysCorrect: 3, stability: 100, cramCriterionMet: true })).toBe(
			'learning'
		);
	});

	it('is one-night when every counting event was one-night mode', () => {
		expect(status({ onlyOneNight: true })).toBe('one-night');
	});

	it('never makes a one-night-only card exam-ready, even at daysCorrect 2 or cram met', () => {
		expect(status({ onlyOneNight: true, daysCorrect: 2, cramCriterionMet: true })).toBe(
			'one-night'
		);
	});

	it('puts one-night before needs-work and secure', () => {
		expect(status({ onlyOneNight: true, daysCorrect: 0 })).toBe('one-night');
		expect(status({ onlyOneNight: true, stability: SECURE_STABILITY_DAYS * 2 })).toBe('one-night');
	});

	it('is needs-work at daysCorrect 0', () => {
		expect(status({ daysCorrect: 0, lastCorrect: false })).toBe('needs-work');
	});

	it('puts needs-work before secure and exam-ready', () => {
		expect(
			status({
				daysCorrect: 0,
				lastCorrect: true,
				stability: SECURE_STABILITY_DAYS * 2,
				cramCriterionMet: true
			})
		).toBe('needs-work');
	});

	it('is secure at stability exactly SECURE_STABILITY_DAYS, not fragile, last correct', () => {
		expect(status({ daysCorrect: 2, stability: SECURE_STABILITY_DAYS })).toBe('secure');
	});

	it('is not secure just below SECURE_STABILITY_DAYS (exam-ready instead)', () => {
		expect(status({ daysCorrect: 2, stability: SECURE_STABILITY_DAYS - 0.01 })).toBe('exam-ready');
	});

	it('lets secure override exam-ready', () => {
		expect(
			status({ daysCorrect: 5, stability: SECURE_STABILITY_DAYS + 1, cramCriterionMet: true })
		).toBe('secure');
	});

	it('is secure without daysCorrect 2 when its own rule holds', () => {
		expect(status({ daysCorrect: 1, stability: SECURE_STABILITY_DAYS })).toBe('secure');
	});

	it('blocks secure while fragile', () => {
		expect(status({ daysCorrect: 2, stability: SECURE_STABILITY_DAYS * 2, fragile: true })).toBe(
			'exam-ready'
		);
	});

	it('blocks secure when the last counting event was wrong', () => {
		expect(
			status({ daysCorrect: 1, stability: SECURE_STABILITY_DAYS * 2, lastCorrect: false })
		).toBe('provisional');
	});

	it('is not secure without an FSRS state', () => {
		expect(status({ daysCorrect: 2, stability: null })).toBe('exam-ready');
	});

	it('is exam-ready at daysCorrect 2 with the last counting event correct', () => {
		expect(status({ daysCorrect: 2 })).toBe('exam-ready');
	});

	it('is provisional at daysCorrect 1', () => {
		expect(status({ daysCorrect: 1 })).toBe('provisional');
	});

	it('is exam-ready at daysCorrect 1 when the latest credited session was cram and met its criterion', () => {
		expect(status({ daysCorrect: 1, cramCriterionMet: true })).toBe('exam-ready');
	});

	it('needs the last counting event correct for exam-ready, even with cram met', () => {
		expect(status({ daysCorrect: 1, cramCriterionMet: true, lastCorrect: false })).toBe(
			'provisional'
		);
	});

	it('falls back to provisional at daysCorrect 2 when the last counting event was wrong', () => {
		// The table says provisional is daysCorrect = 1; the Decisions log makes it the last rule.
		expect(status({ daysCorrect: 2, lastCorrect: false })).toBe('provisional');
	});

	it('is deterministic and traces its decision', () => {
		const input = deepFreeze(facts({ daysCorrect: 2 }));
		const first = deriveStatus(input);
		expect(deriveStatus(input)).toStrictEqual(first);
		expect(first.trace.length).toBeGreaterThan(0);
		for (const entry of first.trace) expect(typeof entry.rule).toBe('string');
	});

	it('reaches every status', () => {
		const seen = new Set<CardStatus>([
			status({ reviewed: false }),
			status({ counted: false }),
			status({ onlyOneNight: true }),
			status({ daysCorrect: 0 }),
			status({ stability: SECURE_STABILITY_DAYS }),
			status({ daysCorrect: 2 }),
			status({})
		]);
		expect([...seen].sort()).toStrictEqual(
			[
				'exam-ready',
				'learning',
				'needs-work',
				'one-night',
				'provisional',
				'secure',
				'unseen'
			].sort()
		);
	});
});
