import { describe, expect, it } from 'vitest';
import { ALPHA, CRITERION_FIRST, NEW_SHARE_MAX, SECURE_AT_EXAM } from '#lib/config/defaults.ts';
import type { ExamFormat } from '#lib/db/schemas/common.ts';
import { cramOrder, morningTopUp, newPerDay, nextGap, triage } from '#lib/engine/cram.ts';
import { DEFAULT_FSRS_CONFIG, retrievabilityAt } from '#lib/engine/fsrs.ts';
import { MS_PER_MINUTE } from '#lib/engine/time.ts';
import {
	AT_RISK,
	AT_RISK_LONG,
	cramCard,
	examAtFor,
	MINUTE_PER_ATTEMPT,
	NOW,
	SECURE,
	stateFrom
} from './cram-fixtures.ts';
import { cardId } from './fixtures.ts';

/** @see BUILD_PLAN §6.6 and Decisions log (Phase 7: `nextGap`, `NEW_SHARE_MAX`) */

const FSRS = DEFAULT_FSRS_CONFIG;
const EXAM = examAtFor(3);
const FORMATS: readonly ExamFormat[] = ['recognition', 'mixed', 'recall'];

describe('triage', () => {
	it('calls a card with no FSRS state new', () => {
		expect(triage(cramCard(1), EXAM, FSRS).result).toBe('new');
	});

	it('calls a card secure when R_exam ≥ SECURE_AT_EXAM', () => {
		expect(retrievabilityAt(SECURE, EXAM, FSRS)).toBeGreaterThanOrEqual(SECURE_AT_EXAM);
		expect(triage(cramCard(1, { fsrs: SECURE }), EXAM, FSRS).result).toBe('secure');
	});

	it('calls a card secure at R_exam = 1 (exam at the moment of its last review)', () => {
		const state = stateFrom([0]);
		expect(triage(cramCard(1, { fsrs: state }), NOW, FSRS).result).toBe('secure');
	});

	it('calls a reviewed card below SECURE_AT_EXAM at-risk', () => {
		expect(retrievabilityAt(AT_RISK, EXAM, FSRS)).toBeLessThan(SECURE_AT_EXAM);
		expect(triage(cramCard(1, { fsrs: AT_RISK }), EXAM, FSRS).result).toBe('at-risk');
	});

	it('takes R at exam time, not now: a card secure now can be at-risk by the exam', () => {
		const card = cramCard(1, { fsrs: AT_RISK_LONG });
		expect(retrievabilityAt(AT_RISK_LONG, examAtFor(7), FSRS)).toBeLessThan(SECURE_AT_EXAM);
		expect(triage(card, examAtFor(7), FSRS).result).toBe('at-risk');
	});

	it('is deterministic, trace included', () => {
		const card = cramCard(1, { fsrs: AT_RISK });
		expect(triage(card, EXAM, FSRS)).toStrictEqual(triage(card, EXAM, FSRS));
	});
});

describe('newPerDay', () => {
	const BIG = 1_000_000;

	it('spreads new cards over D − 1 days: ceil(N_new / (D − 1))', () => {
		expect(
			newPerDay({ nNew: 10, daysToExam: 3, criterion: CRITERION_FIRST, capacityTrials: BIG })
		).toBe(5);
		expect(
			newPerDay({ nNew: 10, daysToExam: 7, criterion: CRITERION_FIRST, capacityTrials: BIG })
		).toBe(2);
		expect(
			newPerDay({ nNew: 7, daysToExam: 4, criterion: CRITERION_FIRST, capacityTrials: BIG })
		).toBe(3);
	});

	it('uses max(1, D − 1) as the divisor at D = 1 and D = 2', () => {
		expect(
			newPerDay({ nNew: 10, daysToExam: 1, criterion: CRITERION_FIRST, capacityTrials: BIG })
		).toBe(10);
		expect(
			newPerDay({ nNew: 10, daysToExam: 2, criterion: CRITERION_FIRST, capacityTrials: BIG })
		).toBe(10);
	});

	it('gives 0 when there are no new cards', () => {
		expect(
			newPerDay({ nNew: 0, daysToExam: 3, criterion: CRITERION_FIRST, capacityTrials: BIG })
		).toBe(0);
	});

	it('caps new trials (cards × criterion) at NEW_SHARE_MAX × the trial capacity', () => {
		const capacityTrials = 40;
		const n = newPerDay({ nNew: 100, daysToExam: 2, criterion: CRITERION_FIRST, capacityTrials });
		expect(n * CRITERION_FIRST).toBeLessThanOrEqual(NEW_SHARE_MAX * capacityTrials);
		expect((n + 1) * CRITERION_FIRST).toBeGreaterThan(NEW_SHARE_MAX * capacityTrials);
	});

	it('lets a course with no reviews still introduce cards (cap is against capacity)', () => {
		const n = newPerDay({ nNew: 4, daysToExam: 2, criterion: CRITERION_FIRST, capacityTrials: 60 });
		expect(n).toBeGreaterThan(0);
	});

	it('allows exactly NEW_SHARE_MAX of the capacity (boundary is ≤)', () => {
		const capacityTrials = (2 * CRITERION_FIRST) / NEW_SHARE_MAX;
		expect(newPerDay({ nNew: 9, daysToExam: 2, criterion: CRITERION_FIRST, capacityTrials })).toBe(
			2
		);
	});

	it('gives 0 with no capacity', () => {
		expect(
			newPerDay({ nNew: 5, daysToExam: 3, criterion: CRITERION_FIRST, capacityTrials: 0 })
		).toBe(0);
	});
});

describe('cramOrder', () => {
	const weak = cramCard(3, { fsrs: AT_RISK });
	const mid = cramCard(2, { fsrs: AT_RISK_LONG });
	const strong = cramCard(1, { fsrs: SECURE });

	it('puts the lowest R_exam first', () => {
		expect(cramOrder([strong, mid, weak], EXAM, FSRS).result).toStrictEqual([
			weak.id,
			mid.id,
			strong.id
		]);
	});

	it('breaks ties by card ID', () => {
		const a = cramCard(5, { fsrs: AT_RISK });
		const b = cramCard(4, { fsrs: AT_RISK });
		expect(cramOrder([a, b], EXAM, FSRS).result).toStrictEqual([b.id, a.id]);
	});

	it('puts never-reviewed cards (R_exam = 0, priority 1) first, by ID', () => {
		// SPEC-GAP: new cards have no R; read as R_exam = 0 (retrievabilityAt of a null state).
		const n2 = cramCard(9);
		const n1 = cramCard(8);
		expect(cramOrder([mid, n2, weak, n1], EXAM, FSRS).result).toStrictEqual([
			n1.id,
			n2.id,
			weak.id,
			mid.id
		]);
	});

	it('does not depend on input order', () => {
		const cards = [weak, mid, strong, cramCard(4, { fsrs: AT_RISK })];
		expect(cramOrder([...cards].reverse(), EXAM, FSRS).result).toStrictEqual(
			cramOrder(cards, EXAM, FSRS).result
		);
	});

	it('returns nothing for no cards', () => {
		expect(cramOrder([], EXAM, FSRS).result).toStrictEqual([]);
	});

	it('is deterministic, trace included', () => {
		expect(cramOrder([weak, mid], EXAM, FSRS)).toStrictEqual(cramOrder([weak, mid], EXAM, FSRS));
	});
});

describe('nextGap', () => {
	const gap = (
		daysRemaining: number,
		examFormat: ExamFormat,
		fsrsIntervalDays: number | null = null,
		weak = false
	) => nextGap({ daysRemaining, examFormat, fsrsIntervalDays, weak });
	const spec = (d: number, f: ExamFormat) =>
		Math.min(Math.max(Math.round(ALPHA[f] * d), 1), Math.max(1, d - 1));

	for (const format of FORMATS) {
		it(`is clamp(round(ALPHA.${format} × daysRemaining), 1, max(1, daysRemaining − 1)) for 1…7 days`, () => {
			for (let d = 1; d <= 7; d += 1) expect(gap(d, format)).toBe(spec(d, format));
		});
	}

	it('spaces wider for recall than recognition exams', () => {
		expect(gap(7, 'recall')).toBe(3);
		expect(gap(7, 'recognition')).toBe(2);
	});

	it('is 1 with one day remaining (upper bound max(1, daysRemaining − 1))', () => {
		for (const format of FORMATS) expect(gap(1, format)).toBe(1);
	});

	it('is at least 1 even when α × daysRemaining rounds to 0', () => {
		expect(Math.round(ALPHA.recognition * 1)).toBe(0);
		expect(gap(1, 'recognition')).toBe(1);
	});

	it('is at most the FSRS interval when known', () => {
		expect(gap(7, 'recall', 1)).toBe(1);
		expect(gap(7, 'recall', 2)).toBe(2);
	});

	it('ignores a longer FSRS interval and a null one', () => {
		expect(gap(7, 'recall', 30)).toBe(gap(7, 'recall', null));
	});

	it('gives weak cards a gap of 1', () => {
		for (const format of FORMATS) expect(gap(7, format, 30, true)).toBe(1);
	});
});

describe('morningTopUp', () => {
	// Every card was reviewed at NOW (R ≈ 1) and every attempt takes one minute, so each card
	// costs about one minute (a little more with the safety margin).
	const fresh = stateFrom([0]);
	const cards = [1, 2, 3, 4, 5].map((n) => cramCard(n, { fsrs: fresh }));
	const base = {
		cards,
		failedIds: [] as ReturnType<typeof cardId>[],
		minutes: 1_000,
		examAt: NOW + 10 * 60 * MS_PER_MINUTE,
		now: NOW,
		calibration: MINUTE_PER_ATTEMPT,
		fsrs: FSRS
	};

	it('takes last night failures first, in the given order', () => {
		const failedIds = [cardId(4), cardId(2)];
		const result = morningTopUp({ ...base, failedIds }).result;
		expect(result.slice(0, 2)).toStrictEqual(failedIds);
	});

	it('then the lowest R_exam cards, ties by ID', () => {
		const mixed = [
			cramCard(1, { fsrs: SECURE }),
			cramCard(2, { fsrs: AT_RISK }),
			cramCard(3, { fsrs: AT_RISK_LONG })
		];
		const result = morningTopUp({ ...base, cards: mixed, failedIds: [cardId(1)] }).result;
		expect(result).toStrictEqual([cardId(1), cardId(2), cardId(3)]);
	});

	it('never lists a card twice or more cards than given', () => {
		const result = morningTopUp({ ...base, failedIds: [cardId(1), cardId(3)] }).result;
		expect(new Set(result).size).toBe(result.length);
		expect(result.length).toBeLessThanOrEqual(cards.length);
	});

	it('ignores failures that are not among the cards given', () => {
		// SPEC-GAP: "never more than the cards given" read as: unknown failed IDs are dropped.
		const result = morningTopUp({ ...base, failedIds: [cardId(99), cardId(2)] }).result;
		expect(result).not.toContain(cardId(99));
		expect(result[0]).toBe(cardId(2));
	});

	it('stops when the minutes run out', () => {
		const result = morningTopUp({ ...base, minutes: 2.5 }).result;
		expect(result).toStrictEqual([cardId(1), cardId(2)]);
	});

	it('takes nothing with no minutes', () => {
		expect(morningTopUp({ ...base, minutes: 0, failedIds: [cardId(1)] }).result).toStrictEqual([]);
	});

	it('is deterministic, trace included', () => {
		expect(morningTopUp({ ...base, failedIds: [cardId(3)] })).toStrictEqual(
			morningTopUp({ ...base, failedIds: [cardId(3)] })
		);
	});
});
