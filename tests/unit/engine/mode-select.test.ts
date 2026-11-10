import { describe, expect, it } from 'vitest';
import { CRAM_MAX_DAYS, LONGTERM_NEW_PER_DAY } from '#lib/config/defaults.ts';
import type { Card } from '#lib/db/schemas/card.ts';
import { longtermCards, todayModes } from '#lib/engine/mode-select.ts';
import { cardId } from './fixtures.ts';

/** @see BUILD_PLAN §6.7 "Mode choice (`todayModes`)" and long-term sessions; Decisions log (Phase 7: mode choice) */

const TODAY = 20_000;
const modes = (examDay: number | null, hasUnread = false) =>
	todayModes({ today: TODAY, examDay, hasUnread }).result;

describe('todayModes: review mode', () => {
	it('reviews in longterm with no exam', () => {
		expect(modes(null)).toStrictEqual({ review: 'longterm', learn: null, daysToExam: null });
	});

	it('reviews in longterm after the exam (handback), with no exam ahead', () => {
		expect(modes(TODAY - 1)).toStrictEqual({ review: 'longterm', learn: null, daysToExam: null });
	});

	it('reviews in longterm when the exam is more than CRAM_MAX_DAYS away', () => {
		const m = modes(TODAY + CRAM_MAX_DAYS + 1);
		expect(m.review).toBe('longterm');
		// SPEC-GAP: an exam beyond CRAM_MAX_DAYS is still "ahead", so daysToExam is its distance.
		expect(m.daysToExam).toBe(CRAM_MAX_DAYS + 1);
	});

	it('crams when the exam is exactly CRAM_MAX_DAYS away', () => {
		expect(modes(TODAY + CRAM_MAX_DAYS)).toMatchObject({
			review: 'cram',
			daysToExam: CRAM_MAX_DAYS
		});
	});

	it('crams on every day from 0 to CRAM_MAX_DAYS before the exam', () => {
		for (let d = 0; d <= CRAM_MAX_DAYS; d += 1) {
			expect(modes(TODAY + d)).toMatchObject({ review: 'cram', daysToExam: d });
		}
	});

	it('crams on exam day itself (0 days)', () => {
		expect(modes(TODAY)).toMatchObject({ review: 'cram', daysToExam: 0 });
	});
});

describe('todayModes: learn mode', () => {
	it('has no learn mode with nothing unread', () => {
		for (const exam of [null, TODAY, TODAY + 1, TODAY + 3, TODAY + 30])
			expect(modes(exam).learn).toBeNull();
	});

	it('learns unread material in one-night mode when the exam is tomorrow', () => {
		expect(modes(TODAY + 1, true)).toMatchObject({
			review: 'cram',
			learn: 'onenight',
			daysToExam: 1
		});
	});

	it('learns unread material in acquisition otherwise', () => {
		for (const exam of [null, TODAY - 2, TODAY + 2, TODAY + CRAM_MAX_DAYS, TODAY + 30]) {
			expect(modes(exam, true).learn).toBe('acquisition');
		}
	});

	it('uses acquisition on exam day itself', () => {
		// SPEC-GAP: the spec says one-night only "when the exam is tomorrow"; on exam day (0 days)
		// read literally as acquisition.
		expect(modes(TODAY, true).learn).toBe('acquisition');
	});

	it('is deterministic, trace included', () => {
		const input = { today: TODAY, examDay: TODAY + 1, hasUnread: true };
		expect(todayModes(input)).toStrictEqual(todayModes(input));
	});
});

type LtCard = Pick<Card, 'id' | 'due' | 'status' | 'suspended'>;
const NOW = 1_800_000_000_000;
const lt = (n: number, overrides: Partial<LtCard> = {}): LtCard => ({
	id: cardId(n),
	status: 'provisional',
	suspended: false,
	due: NOW - 1,
	...overrides
});

describe('longtermCards', () => {
	it('takes due cards, earliest due first', () => {
		const cards = [lt(1, { due: NOW - 10 }), lt(2, { due: NOW - 30 }), lt(3, { due: NOW - 20 })];
		expect(longtermCards({ cards, newCandidates: [], now: NOW }).result).toStrictEqual([
			cardId(2),
			cardId(3),
			cardId(1)
		]);
	});

	it('breaks due ties by ID', () => {
		const cards = [lt(3), lt(1), lt(2)];
		expect(longtermCards({ cards, newCandidates: [], now: NOW }).result).toStrictEqual([
			cardId(1),
			cardId(2),
			cardId(3)
		]);
	});

	it('counts a card due exactly now as due', () => {
		expect(
			longtermCards({ cards: [lt(1, { due: NOW })], newCandidates: [], now: NOW }).result
		).toStrictEqual([cardId(1)]);
	});

	it('leaves out cards due later and cards with no due', () => {
		const cards = [lt(1, { due: NOW + 1 }), lt(2, { due: undefined }), lt(3)];
		expect(longtermCards({ cards, newCandidates: [], now: NOW }).result).toStrictEqual([cardId(3)]);
	});

	it('includes a learning card handed off by acquisition once due', () => {
		const cards = [lt(1, { status: 'learning', due: NOW - 5 })];
		expect(longtermCards({ cards, newCandidates: [], now: NOW }).result).toStrictEqual([cardId(1)]);
	});

	it('does not treat unseen cards as due', () => {
		const cards = [lt(1, { status: 'unseen' }), lt(2)];
		expect(longtermCards({ cards, newCandidates: [], now: NOW }).result).toStrictEqual([cardId(2)]);
	});

	it('never includes suspended cards', () => {
		const cards = [
			lt(1, { suspended: true }),
			lt(2),
			lt(3, { status: 'unseen', suspended: true, due: undefined })
		];
		const result = longtermCards({ cards, newCandidates: [cardId(3)], now: NOW }).result;
		expect(result).toStrictEqual([cardId(2)]);
	});

	it('then adds unseen new candidates in the order given', () => {
		const cards = [
			lt(1),
			lt(5, { status: 'unseen', due: undefined }),
			lt(4, { status: 'unseen', due: undefined })
		];
		const result = longtermCards({ cards, newCandidates: [cardId(5), cardId(4)], now: NOW }).result;
		expect(result).toStrictEqual([cardId(1), cardId(5), cardId(4)]);
	});

	it('adds at most LONGTERM_NEW_PER_DAY new cards', () => {
		const ids = Array.from({ length: LONGTERM_NEW_PER_DAY + 5 }, (_, i) => cardId(100 + i));
		const cards = ids.map((id) => ({
			id,
			status: 'unseen' as const,
			suspended: false,
			due: undefined
		}));
		const result = longtermCards({ cards, newCandidates: ids, now: NOW }).result;
		expect(result).toStrictEqual(ids.slice(0, LONGTERM_NEW_PER_DAY));
	});

	it('returns nothing with nothing due and no candidates', () => {
		expect(longtermCards({ cards: [], newCandidates: [], now: NOW }).result).toStrictEqual([]);
	});

	it('is deterministic, trace included', () => {
		const input = { cards: [lt(2), lt(1)], newCandidates: [], now: NOW };
		expect(longtermCards(input)).toStrictEqual(longtermCards(input));
	});
});
