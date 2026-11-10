import { describe, expect, it } from 'vitest';
import { PRETEST_AUTOHIDE_SKIPS, SPLIT_THRESHOLD } from '#lib/config/defaults.ts';
import {
	acquisitionUnits,
	choosePath,
	pretestVisible,
	quizKind,
	shouldPromptSplit,
	splitFlagFor,
	type AcqCard,
	type AcqChunk,
	type AcqTopic
} from '#lib/engine/acquisition.ts';
import { cardId, chunkId, topicId } from './fixtures.ts';

/** @see BUILD_PLAN §6.7 (Units, split flag, path, pretest), CONCEPT §8, Decisions log (Phase 7: acquisition units) */

const topic = (n: number, overrides: Partial<AcqTopic> = {}): AcqTopic => ({
	id: topicId(n),
	order: n,
	priority: 'normal',
	placement: 'unread',
	...overrides
});
const chunk = (
	n: number,
	t: number,
	order: number,
	overrides: Partial<AcqChunk> = {}
): AcqChunk => ({
	id: chunkId(100 + n),
	topicId: topicId(t),
	order,
	words: 200 + n,
	...overrides
});
/** A cloze card of topic `t`, in chunk `c` (or none). */
const card = (
	n: number,
	t: number,
	c: number | null,
	overrides: Partial<AcqCard> = {}
): AcqCard => ({
	id: cardId(n),
	topicId: topicId(t),
	...(c === null ? {} : { chunkId: chunkId(100 + c) }),
	noteType: 'cloze',
	path: ['cloze'],
	kind: 'cloze',
	...overrides
});
const keys = (units: { key: string }[]) => units.map((u) => u.key);
const ck = (c: number) => `chunk:${chunkId(100 + c)}`;
const tk = (t: number) => `topic:${topicId(t)}`;

describe('acquisitionUnits: what a unit is', () => {
	it('makes one unit per chunk of an unread topic, holding its notes cards in the given order', () => {
		const { result } = acquisitionUnits({
			topics: [topic(1)],
			chunks: [chunk(1, 1, 0)],
			cards: [card(3, 1, 1), card(1, 1, 1), card(2, 1, 1)],
			breadth: false
		});
		expect(result).toStrictEqual([
			{
				key: ck(1),
				topicId: topicId(1),
				chunkId: chunkId(101),
				words: 201,
				cardIds: [cardId(3), cardId(1), cardId(2)]
			}
		]);
	});

	it('makes one chunk-less unit per topic for its notes with no chunk, after its chunks, with no words', () => {
		const { result } = acquisitionUnits({
			topics: [topic(1)],
			chunks: [chunk(1, 1, 0)],
			cards: [card(1, 1, null), card(2, 1, 1), card(3, 1, null)],
			breadth: false
		});
		expect(keys(result)).toStrictEqual([ck(1), tk(1)]);
		expect(result[1]).toStrictEqual({
			key: tk(1),
			topicId: topicId(1),
			chunkId: null,
			words: 0,
			cardIds: [cardId(1), cardId(3)]
		});
	});

	it('skips topics placed as read', () => {
		const { result } = acquisitionUnits({
			topics: [topic(1, { placement: 'read' }), topic(2)],
			chunks: [chunk(1, 1, 0), chunk(2, 2, 0)],
			cards: [card(1, 1, 1), card(2, 1, null), card(3, 2, 2)],
			breadth: false
		});
		expect(keys(result)).toStrictEqual([ck(2)]);
	});

	it('leaves out reported chunks and their cards', () => {
		// SPEC-GAP: a reported chunk's cards are read as left out too (not moved to the topic unit).
		const { result } = acquisitionUnits({
			topics: [topic(1)],
			chunks: [chunk(1, 1, 0, { reported: true }), chunk(2, 1, 1)],
			cards: [card(1, 1, 1), card(2, 1, 2)],
			breadth: false
		});
		expect(keys(result)).toStrictEqual([ck(2)]);
		expect(result.flatMap((u) => u.cardIds)).toStrictEqual([cardId(2)]);
	});

	it('leaves out chunks and topics with no cards', () => {
		const { result } = acquisitionUnits({
			topics: [topic(1), topic(2)],
			chunks: [chunk(1, 1, 0), chunk(2, 1, 1)],
			cards: [card(1, 1, 2)],
			breadth: false
		});
		expect(keys(result)).toStrictEqual([ck(2)]);
	});

	it('returns nothing for no topics', () => {
		expect(
			acquisitionUnits({ topics: [], chunks: [], cards: [], breadth: false }).result
		).toStrictEqual([]);
	});
});

describe('acquisitionUnits: order', () => {
	// Topic 1 normal (order 0): chunks 1, 2. Topic 2 high (order 1): chunks 3, 4. Topic 3 high
	// (order 2): chunk 5 and a chunk-less note. Given out of order on purpose.
	const input = {
		topics: [
			topic(3, { priority: 'high', order: 2 }),
			topic(1, { order: 0 }),
			topic(2, { priority: 'high', order: 1 })
		],
		chunks: [chunk(4, 2, 1), chunk(2, 1, 1), chunk(5, 3, 0), chunk(1, 1, 0), chunk(3, 2, 0)],
		cards: [
			card(1, 1, 1),
			card(2, 1, 2),
			card(3, 2, 3),
			card(4, 2, 4),
			card(5, 3, 5),
			card(6, 3, null)
		]
	};
	const depth = [ck(3), ck(4), ck(5), tk(3), ck(1), ck(2)];

	it('goes in depth order: high-priority topics first, then topic order, then chunk order', () => {
		expect(keys(acquisitionUnits({ ...input, breadth: false }).result)).toStrictEqual(depth);
	});

	it('in breadth order takes the first unit of each high-priority topic first, then the rest in depth order', () => {
		const breadth = [ck(3), ck(5), ck(4), tk(3), ck(1), ck(2)];
		expect(keys(acquisitionUnits({ ...input, breadth: true }).result)).toStrictEqual(breadth);
	});

	it('in breadth order with no high-priority topics is the depth order', () => {
		const normal = {
			...input,
			topics: input.topics.map((t) => ({ ...t, priority: 'normal' as const }))
		};
		const d = keys(acquisitionUnits({ ...normal, breadth: false }).result);
		expect(keys(acquisitionUnits({ ...normal, breadth: true }).result)).toStrictEqual(d);
		expect(d).toStrictEqual([ck(1), ck(2), ck(3), ck(4), ck(5), tk(3)]);
	});

	it('is deterministic, trace included', () => {
		expect(acquisitionUnits({ ...input, breadth: true })).toStrictEqual(
			acquisitionUnits({ ...input, breadth: true })
		);
	});
});

describe('quizKind', () => {
	it('uses cloze when it is on the card path', () => {
		expect(quizKind({ path: ['mc', 'sequence', 'cloze'], kind: 'mc' })).toBe('cloze');
	});

	it('uses sequence when cloze is not on the path but sequence is', () => {
		expect(quizKind({ path: ['parsons', 'sequence'], kind: 'parsons' })).toBe('sequence');
	});

	it('falls back to the current kind (mc only as fallback)', () => {
		expect(quizKind({ path: ['mc', 'newInstance'], kind: 'mc' })).toBe('mc');
	});
});

describe('pretestVisible', () => {
	it('shows the pretest until PRETEST_AUTOHIDE_SKIPS skips', () => {
		expect(pretestVisible(0)).toBe(true);
		expect(pretestVisible(PRETEST_AUTOHIDE_SKIPS - 1)).toBe(true);
	});

	it('hides it for the session after PRETEST_AUTOHIDE_SKIPS skips', () => {
		expect(pretestVisible(PRETEST_AUTOHIDE_SKIPS)).toBe(false);
		expect(pretestVisible(PRETEST_AUTOHIDE_SKIPS + 1)).toBe(false);
	});
});

describe('split flag', () => {
	/** `n` answers with a share `accuracy` correct. */
	const answers = (n: number, accuracy: number) =>
		Array.from({ length: n }, (_, i) => ({ correct: i < Math.round(n * accuracy) }));

	it('flags a chunk whose first-attempt quiz accuracy is below SPLIT_THRESHOLD', () => {
		expect(splitFlagFor(answers(8, SPLIT_THRESHOLD - 1 / 8))).toBe(true);
	});

	it('does not flag exactly SPLIT_THRESHOLD', () => {
		expect(splitFlagFor(answers(4, SPLIT_THRESHOLD))).toBe(false);
	});

	it('does not flag with no answers', () => {
		expect(splitFlagFor([])).toBe(false);
	});

	it('prompts a split only when flagged and the next-day retest is still below threshold', () => {
		expect(shouldPromptSplit(true, answers(4, 0.5))).toBe(true);
		expect(shouldPromptSplit(false, answers(4, 0.5))).toBe(false);
		expect(shouldPromptSplit(true, answers(4, SPLIT_THRESHOLD))).toBe(false);
	});

	it('does not prompt with no retest answers yet', () => {
		// SPEC-GAP: no retest data read as "not still below" → no prompt.
		expect(shouldPromptSplit(true, [])).toBe(false);
	});
});

describe('choosePath', () => {
	it('follows a full or quick user setting whatever the feasibility', () => {
		expect(choosePath('full', false)).toBe('full');
		expect(choosePath('quick', true)).toBe('quick');
	});

	it('on auto picks full when feasible, quick when not', () => {
		expect(choosePath('auto', true)).toBe('full');
		expect(choosePath('auto', false)).toBe('quick');
	});
});
