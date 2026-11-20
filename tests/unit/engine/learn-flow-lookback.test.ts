import { describe, expect, it } from 'vitest';
import { LOOKBACK_MIN_DISTANCE } from '#lib/config/defaults.ts';
import type { CardId } from '#lib/db/schemas/common.ts';
import { pickLookBack, type LearnCard } from '#lib/engine/learn-flow.ts';
import { createRng } from '#lib/engine/rng.ts';
import { cardId, chunkId, noteId, topicId } from './fixtures.ts';

/**
 * The look-back after a section: one card from an earlier, already-read section.
 *
 * @see SESSION_NOTES §C, H; Decisions log "Phase 8.6 Q8"
 */

const S = (n: number) => chunkId(100 + n);
const ORDER = [1, 2, 3, 4, 5, 6].map(S);

let counter = 0;
const lc = (section: number | null, extra: Partial<LearnCard> = {}): LearnCard => {
	counter += 1;
	return {
		id: cardId(counter),
		noteId: noteId(counter),
		topicId: topicId(1),
		chunkId: section === null ? null : S(section),
		kind: 'mc',
		lastCorrect: true,
		lastSeenAt: 1_000,
		...extra
	};
};

const pick = (
	cards: LearnCard[],
	current: number,
	read: number[] = [1, 2, 3, 4, 5, 6],
	seed = 1
): CardId | null =>
	pickLookBack({
		order: ORDER,
		current: S(current),
		read: new Set(read.map(S)),
		cards,
		rng: createRng(seed)
	}).result;

describe('pickLookBack: which sections are candidates', () => {
	it('comes only from a section at least LOOKBACK_MIN_DISTANCE back', () => {
		expect(LOOKBACK_MIN_DISTANCE).toBe(2);
		const back1 = lc(3);
		const back2 = lc(2);
		const here = lc(4);
		expect(pick([back1, here, back2], 4)).toBe(back2.id);
	});

	it('is null when no section is far enough back (the first two sections)', () => {
		const cards = [lc(1), lc(2)];
		expect(pick(cards, 1)).toBeNull();
		expect(pick(cards, 2)).toBeNull();
	});

	it('can look back from the third section to the first', () => {
		const first = lc(1);
		expect(pick([first, lc(2), lc(3)], 3)).toBe(first.id);
	});

	it('never picks from a section the student has not read in Learn', () => {
		const unread = lc(1);
		const readCard = lc(2);
		expect(pick([unread, readCard], 5, [2, 3, 4, 5])).toBe(readCard.id);
		expect(pick([unread], 5, [2, 3, 4, 5])).toBeNull();
	});

	it('never picks from a later section or a card with no section', () => {
		expect(pick([lc(5), lc(6), lc(null)], 4)).toBeNull();
	});

	it('is null with no cards', () => {
		expect(pick([], 5)).toBeNull();
	});
});

describe('pickLookBack: ranking', () => {
	it('favours a card whose latest answer was wrong over a more stale right one', () => {
		const stale = lc(1, { lastCorrect: true, lastSeenAt: 10 });
		const missed = lc(2, { lastCorrect: false, lastSeenAt: 9_000 });
		expect(pick([stale, missed], 5)).toBe(missed.id);
	});

	it('among wrong cards, takes the least recently seen', () => {
		const newer = lc(1, { lastCorrect: false, lastSeenAt: 500 });
		const older = lc(2, { lastCorrect: false, lastSeenAt: 100 });
		expect(pick([newer, older], 5)).toBe(older.id);
	});

	it('among right cards, takes the least recently seen', () => {
		const newer = lc(1, { lastSeenAt: 500 });
		const older = lc(2, { lastSeenAt: 100 });
		expect(pick([newer, older], 5)).toBe(older.id);
	});

	it('counts a never-seen card (lastSeenAt null) as the oldest', () => {
		const seen = lc(1, { lastSeenAt: 1 });
		const never = lc(2, { lastCorrect: null, lastSeenAt: null });
		// SPEC-GAP: a never-answered card ranks with the right ones (only `false` is favoured).
		expect(pick([seen, never], 5)).toBe(never.id);
	});

	it('does not let rng change a result that has a single best card', () => {
		const best = lc(1, { lastCorrect: false, lastSeenAt: 1 });
		const cards = [best, lc(2), lc(3)];
		for (let seed = 0; seed < 25; seed += 1) expect(pick(cards, 5, undefined, seed)).toBe(best.id);
	});
});

describe('pickLookBack: ties and determinism', () => {
	const tied = [lc(1, { lastSeenAt: 7 }), lc(2, { lastSeenAt: 7 }), lc(3, { lastSeenAt: 7 })];

	it('chooses among cards tied at the top with the seeded rng, each reachable', () => {
		const seen = new Set<CardId | null>();
		for (let seed = 0; seed < 80; seed += 1) seen.add(pick(tied, 6, undefined, seed));
		expect(seen).toEqual(new Set(tied.map((card) => card.id)));
	});

	it('never picks a card that is not tied at the top', () => {
		const worse = lc(4, { lastSeenAt: 99 });
		for (let seed = 0; seed < 40; seed += 1) {
			expect(pick([...tied, worse], 6, undefined, seed)).not.toBe(worse.id);
		}
	});

	it('is deterministic for the same seed, and returns a trace array', () => {
		const input = {
			order: ORDER,
			current: S(6),
			read: new Set(ORDER),
			cards: tied,
			rng: createRng(5)
		};
		const a = pickLookBack(input);
		const b = pickLookBack({ ...input, rng: createRng(5) });
		expect(b).toEqual(a);
		expect(Array.isArray(a.trace)).toBe(true);
	});
});
