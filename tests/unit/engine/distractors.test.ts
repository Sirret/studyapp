import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MC_OPTIONS } from '#lib/config/defaults.ts';
import { confusionCounts, pickDistractors } from '#lib/engine/distractors.ts';
import {
	choiceInput,
	confusions,
	entry,
	fakeRng,
	ids,
	optionIds,
	rngValues
} from './answer-fixtures.ts';
import { cardId, NUM_RUNS, topicId } from './fixtures.ts';

const pick = (...args: Parameters<typeof choiceInput>) =>
	pickDistractors(choiceInput(...args)).result;

/** @see BUILD_PLAN §6.11, DATA_MODEL §3.6 (`chosenFromCardId`) and Decisions log (distractor tiers) */
describe('confusionCounts', () => {
	const T = cardId(1);

	it('counts review events whose chosenFromCardId pairs the two cards, either way round', () => {
		const counts = confusionCounts(
			[
				{ cardId: T, chosenFromCardId: cardId(2) },
				{ cardId: cardId(2), chosenFromCardId: T },
				{ cardId: T, chosenFromCardId: cardId(3) }
			],
			T
		);
		expect(counts.get(cardId(2))).toBe(2);
		expect(counts.get(cardId(3))).toBe(1);
	});

	it('ignores events without chosenFromCardId and pairs not involving the target', () => {
		const counts = confusionCounts(
			[{ cardId: T }, { cardId: cardId(2), chosenFromCardId: cardId(3) }, { cardId: cardId(4) }],
			T
		);
		expect(counts.get(cardId(2)) ?? 0).toBe(0);
		expect(counts.get(cardId(3)) ?? 0).toBe(0);
		expect(counts.get(cardId(4)) ?? 0).toBe(0);
	});

	it('is empty for no events', () => {
		expect(confusionCounts([], T).size).toBe(0);
	});
});

/** @see BUILD_PLAN §6.11 and Decisions log (distractor tiers) */
describe('pickDistractors: tiers', () => {
	it('fills siblings or shared tags first, then same topic, before the rest of the course', () => {
		const target = entry(1, 'TCP', { group: 'net', tags: ['transport'] });
		const pool = [
			entry(40, 'UDP', { topicId: topicId(2), group: 'net' }),
			entry(41, 'ICMP', { topicId: topicId(9), tags: ['transport'] }),
			entry(20, 'HTTP'),
			entry(21, 'FTP'),
			entry(30, 'ARP', { topicId: topicId(3) })
		];
		// ARP has the most confusions but is only in the course tier.
		const set = pick(target, pool, { confusions: confusions([[30, 99]]) });
		expect(optionIds(set)).toEqual(ids(1, 40, 41, 21));
	});

	it('does not treat two entries without a group as siblings', () => {
		const target = entry(1, 'TCP');
		const pool = [
			entry(30, 'ARP', { topicId: topicId(3) }),
			entry(20, 'HTTPS'),
			entry(21, 'SMTP'),
			entry(22, 'POP3')
		];
		expect(optionIds(pick(target, pool))).toEqual(ids(1, 20, 21, 22));
	});

	it('falls back to the course tier, ranked, when the topic runs short', () => {
		const target = entry(1, 'TCP');
		const pool = [
			entry(20, 'HTTP'),
			entry(30, 'ARP', { topicId: topicId(3) }),
			entry(31, 'DNS', { topicId: topicId(3) }),
			entry(32, 'BGP', { topicId: topicId(4) })
		];
		const set = pick(target, pool, { confusions: confusions([[31, 5]]) });
		expect(optionIds(set)).toEqual(ids(1, 20, 31, 30));
	});

	it('only draws answers of the same kind', () => {
		const target = entry(1, 'TCP', { group: 'net' });
		const pool = [
			entry(20, 'A reliable byte stream', { kind: 'definition', group: 'net' }),
			entry(21, 'Open a socket', { kind: 'step' }),
			entry(22, 'UDP')
		];
		expect(optionIds(pick(target, pool))).toEqual(ids(1, 22));
		const definition = entry(2, 'A connectionless protocol', { kind: 'definition' });
		expect(optionIds(pick(definition, pool))).toEqual(ids(2, 20));
	});
});

/** @see BUILD_PLAN §6.11 (rank by confusion, then similar length, then ID) */
describe('pickDistractors: ranking within a tier', () => {
	const target = entry(1, 'stack');

	it('ranks by confusion count first, then by length difference', () => {
		const pool = [
			entry(50, 'queue'),
			entry(51, 'heap'),
			entry(52, 'deque'),
			entry(53, 'array'),
			entry(54, 'linked list')
		];
		const set = pick(target, pool, {
			confusions: confusions([
				[54, 3],
				[51, 1]
			])
		});
		expect(optionIds(set)).toEqual(ids(1, 54, 51, 50));
	});

	it('breaks length ties by card ID', () => {
		const pool = [
			entry(53, 'array'),
			entry(50, 'queue'),
			entry(55, 'trees'),
			entry(52, 'deque'),
			entry(51, 'heap'),
			entry(54, 'linked list')
		];
		expect(optionIds(pick(target, pool))).toEqual(ids(1, 50, 52, 53));
	});

	it('measures length on the normalised text', () => {
		// "  (graph)  " normalises to "graph" (5), same as "stack".
		const pool = [
			entry(60, '  (graph)  '),
			entry(56, 'tries'),
			entry(57, 'B-tree'),
			entry(58, 'tries2')
		];
		expect(optionIds(pick(target, pool))).toEqual(ids(1, 56, 57, 60));
	});
});

/** @see BUILD_PLAN §6.11 and Decisions log (exclusions, short pools) */
describe('pickDistractors: exclusions and short pools', () => {
	const target = entry(1, 'TCP');

	it('skips the target, its duplicates, its accepted synonyms, and keeps the best of duplicate texts', () => {
		const pool = [
			target,
			entry(23, 'tcp '),
			entry(24, 'transmission control protocol.'),
			entry(25, 'UDP'),
			entry(26, 'udp')
		];
		const set = pick(target, pool, {
			accepted: ['Transmission Control Protocol'],
			confusions: confusions([[26, 2]])
		});
		expect(optionIds(set)).toEqual(ids(1, 26));
	});

	it('keeps the lower card ID among equal-ranked duplicate texts', () => {
		const set = pick(target, [entry(26, 'udp'), entry(25, 'UDP')]);
		expect(optionIds(set)).toEqual(ids(1, 25));
	});

	it('gives only the answer for an empty pool, never padding', () => {
		const set = pick(target, []);
		expect(set.options).toEqual([{ text: 'TCP', cardId: cardId(1) }]);
		expect(set.correctIndex).toBe(0);
		expect(pick(target, [target]).options).toHaveLength(1);
	});

	it('gives exactly MC_OPTIONS options when the pool is large', () => {
		const pool = Array.from({ length: 10 }, (_, i) => entry(100 + i, `proto${i}`));
		expect(pick(target, pool).options).toHaveLength(MC_OPTIONS);
	});
});

/** @see BUILD_PLAN §6.11 (option order is a seeded shuffle) */
describe('pickDistractors: seeded order', () => {
	const target = entry(1, 'TCP', { group: 'net' });
	const pool = [
		entry(20, 'UDP', { group: 'net' }),
		entry(21, 'ICMP', { group: 'net' }),
		entry(22, 'ARP'),
		entry(23, 'HTTP'),
		entry(24, 'DNS')
	];
	const textOf = new Map([target, ...pool].map((e) => [e.cardId, e.text]));

	it('puts correctIndex on the target’s text and keeps each option’s own text', () => {
		fc.assert(
			fc.property(rngValues, (values) => {
				const set = pick(target, pool, { rng: fakeRng(values) });
				expect(set.options[set.correctIndex]).toEqual({ text: 'TCP', cardId: cardId(1) });
				set.options.forEach((o) => expect(o.text).toBe(textOf.get(o.cardId)));
			}),
			{ numRuns: NUM_RUNS }
		);
	});

	it('picks the same options whatever the seed; only the order may change', () => {
		const expected = optionIds(pick(target, pool));
		fc.assert(
			fc.property(rngValues, (values) => {
				expect(optionIds(pick(target, pool, { rng: fakeRng(values) }))).toEqual(expected);
			}),
			{ numRuns: NUM_RUNS }
		);
	});

	it('is deterministic: the same seed gives an identical result and trace', () => {
		fc.assert(
			fc.property(rngValues, (values) => {
				const a = pickDistractors(choiceInput(target, pool, { rng: fakeRng(values) }));
				const b = pickDistractors(choiceInput(target, pool, { rng: fakeRng(values) }));
				expect(a).toEqual(b);
			}),
			{ numRuns: NUM_RUNS }
		);
	});
});
