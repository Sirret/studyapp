import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CardSchema } from '#lib/db/schemas/card.ts';
import type { Meta } from '#lib/db/schemas/common.ts';
import { ChunkSchema, CourseSchema, MediaSchema, TopicSchema } from '#lib/db/schemas/course.ts';
import { StudyEventSchema } from '#lib/db/schemas/event.ts';
import { NoteSchema } from '#lib/db/schemas/note.ts';
import { merge, pickWinner } from '#lib/engine/merge.ts';
import type { MergeData } from '#lib/engine/merge.ts';
import { replay } from '#lib/engine/replay.ts';
import {
	arbLabelled,
	arbReordered,
	arbThreeSides,
	arbTwoSides,
	byEventKey,
	byId,
	CARD_POOL,
	cardId,
	compareText,
	CONTENT_KEYS,
	deepFreeze,
	DEVICE_A,
	DEVICE_B,
	eventId,
	makeAcceptAdded,
	makeCard,
	makeChunk,
	makeCourse,
	makeData,
	makeMedia,
	makeNote,
	makePretest,
	makeReview,
	makeSelfRated,
	makeTopic,
	NUM_RUNS,
	oneOfEach,
	replayCards,
	T1,
	T2
} from './fixtures.ts';
import type { ContentRecord, LabelledRecord } from './fixtures.ts';

const RUNS = { numRuns: NUM_RUNS };
const label = (updatedAt: number, deviceId: typeof DEVICE_A, name: string): LabelledRecord => ({
	updatedAt,
	deviceId,
	label: name,
	tags: []
});

function expectWinner(a: LabelledRecord, b: LabelledRecord, winner: LabelledRecord): void {
	expect(pickWinner(a, b)).toStrictEqual(winner);
	expect(pickWinner(b, a)).toStrictEqual(winner);
}

describe('fixtures', () => {
	it('match the zod schemas, so the tests exercise real records', () => {
		expect(() => {
			CourseSchema.parse(makeCourse());
			TopicSchema.parse(makeTopic());
			ChunkSchema.parse(makeChunk());
			NoteSchema.parse(makeNote());
			CardSchema.parse(makeCard());
			MediaSchema.parse(makeMedia());
			for (const event of [makeReview(), makePretest(), makeSelfRated(), makeAcceptAdded()]) {
				StudyEventSchema.parse(event);
			}
		}).not.toThrow();
	});

	it('generate tied records with differing content, and events with tied order keys', () => {
		const samples = fc.sample(arbTwoSides, { numRuns: 200, seed: 7 });
		const tiedContent = samples.some(([a, b]) =>
			a.cards.some((x) =>
				b.cards.some(
					(y) =>
						x.id === y.id &&
						x.updatedAt === y.updatedAt &&
						x.deviceId === y.deviceId &&
						!x.deleted &&
						!y.deleted &&
						JSON.stringify(x) !== JSON.stringify(y)
				)
			)
		);
		const tiedKeys = samples.some(([a]) =>
			a.events.some((x) => a.events.some((y) => x.id !== y.id && byEventKey(x, y) === 0))
		);
		expect(tiedContent).toBe(true);
		expect(tiedKeys).toBe(true);
	});
});

describe('pickWinner', () => {
	const older = label(T1, DEVICE_B, 'older');
	const newer = label(T2, DEVICE_A, 'newer');

	it('picks the newer updatedAt, even from the lower deviceId', () => {
		expectWinner(older, newer, newer);
	});

	it('breaks an updatedAt tie by the higher deviceId', () => {
		const low = label(T1, DEVICE_A, 'low');
		const high = label(T1, DEVICE_B, 'high');
		expectWinner(low, high, high);
	});

	it('lets a tombstone win over an older edit', () => {
		const tombstone: LabelledRecord = { ...newer, deleted: true };
		expectWinner(older, tombstone, tombstone);
	});

	it('lets a newer edit win over an older tombstone', () => {
		expectWinner({ ...older, deleted: true }, newer, newer);
	});

	it('lets a tombstone win when updatedAt and deviceId both tie', () => {
		const live = label(T1, DEVICE_A, 'live');
		const tombstone: LabelledRecord = { ...label(T1, DEVICE_A, 'dead'), deleted: true };
		expectWinner(live, tombstone, tombstone);
	});

	it('does not let a tombstone beat a higher deviceId at the same updatedAt', () => {
		const tombstone: LabelledRecord = { ...label(T1, DEVICE_A, 'dead'), deleted: true };
		const live = label(T1, DEVICE_B, 'live');
		expectWinner(tombstone, live, live);
	});

	// SPEC-GAP: which record wins a full tie of two live records (or two tombstones) with different
	// content? The spec only demands that the choice does not depend on argument order.
	it.each<[string, Partial<LabelledRecord>, Partial<LabelledRecord>]>([
		['two live records', { label: 'x' }, { label: 'y' }],
		['two tombstones', { label: 'x', deleted: true }, { label: 'y', deleted: true }],
		['records differing only inside a nested array', { tags: ['p', 'q'] }, { tags: ['q', 'p'] }]
	])('does not depend on argument order in a full tie of %s', (_name, x, y) => {
		const a = { ...label(T1, DEVICE_A, 'base'), ...x };
		const b = { ...label(T1, DEVICE_A, 'base'), ...y };
		const winner = pickWinner(a, b);
		expect([a, b]).toContainEqual(winner);
		expect(pickWinner(b, a)).toStrictEqual(winner);
	});

	// SPEC-GAP: is deviceId compared by code unit? `localeCompare` would order mixed-case ids
	// differently per locale, so this reads "(updatedAt, deviceId)" as locale-independent.
	it('compares deviceId by code unit, so the winner is the same under every locale', () => {
		const upper = label(T1, 'B0000000-0000-4000-8000-000000000000' as typeof DEVICE_A, 'upper');
		const lower = label(T1, 'a0000000-0000-4000-8000-000000000000' as typeof DEVICE_A, 'lower');
		expectWinner(upper, lower, lower);
	});

	it('is commutative, idempotent and associative on any records', () => {
		fc.assert(
			fc.property(arbLabelled, arbLabelled, arbLabelled, (a, b, c) => {
				expect(pickWinner(a, b)).toStrictEqual(pickWinner(b, a));
				expect(pickWinner(a, a)).toStrictEqual(a);
				expect(pickWinner(pickWinner(a, b), c)).toStrictEqual(pickWinner(a, pickWinner(b, c)));
			}),
			RUNS
		);
	});
});

describe('merge: content is last-write-wins', () => {
	const tomb: Partial<Meta> = { deleted: true };
	it.each<[string, Partial<Meta>, Partial<Meta>]>([
		[
			'a newer updatedAt beats an older one, whatever the deviceId',
			{ updatedAt: T1, deviceId: DEVICE_B },
			{ updatedAt: T2, deviceId: DEVICE_A }
		],
		[
			'the higher deviceId wins an updatedAt tie',
			{ updatedAt: T1, deviceId: DEVICE_A },
			{ updatedAt: T1, deviceId: DEVICE_B }
		],
		[
			'a tombstone beats an older edit',
			{ updatedAt: T1, deviceId: DEVICE_A },
			{ updatedAt: T2, deviceId: DEVICE_A, ...tomb }
		],
		[
			'a newer edit beats an older tombstone',
			{ updatedAt: T1, deviceId: DEVICE_A, ...tomb },
			{ updatedAt: T2, deviceId: DEVICE_A }
		],
		[
			'a tombstone wins a full tie',
			{ updatedAt: T1, deviceId: DEVICE_A },
			{ updatedAt: T1, deviceId: DEVICE_A, ...tomb }
		]
	])('in every content collection, %s', (_name, loserMeta, winnerMeta) => {
		const loser = oneOfEach(loserMeta, 'loser');
		const winner = oneOfEach(winnerMeta, 'winner');
		for (const [a, b] of [
			[loser, winner],
			[winner, loser]
		] as const) {
			const { data } = merge(a, b).result;
			for (const key of CONTENT_KEYS) expect(data[key]).toStrictEqual(winner[key]);
		}
	});

	it('does not depend on argument order in a full tie with different content, per collection', () => {
		const a = oneOfEach({ updatedAt: T1, deviceId: DEVICE_A }, 'x');
		const b = oneOfEach({ updatedAt: T1, deviceId: DEVICE_A }, 'y');
		expect(merge(a, b)).toStrictEqual(merge(b, a));
	});

	it('takes the winner whole, without mixing in fields from the loser', () => {
		const loser = makeCourse({ updatedAt: T1, examDate: '2026-01-01' });
		const winner = makeCourse({ updatedAt: T2, name: 'renamed' });
		const { courses } = merge(makeData({ courses: [loser] }), makeData({ courses: [winner] }))
			.result.data;
		expect(courses).toStrictEqual([winner]);
	});

	it('keeps records held by one side, sorted by id', () => {
		const [one, two, three] = [1, 2, 3].map((n) => makeCard({ id: cardId(n) }));
		if (!one || !two || !three) throw new Error('fixture');
		const merged = merge(makeData({ cards: [three, one] }), makeData({ cards: [two] }));
		expect(merged.result.data.cards).toStrictEqual([one, two, three]);
	});

	it('leaves the winning card caches as they were, for the caller to replay', () => {
		const accuracy = { n: 5, correct: 4 };
		const winner = makeCard({ updatedAt: T2, status: 'learning', accuracy });
		const merged = merge(makeData({ cards: [makeCard()] }), makeData({ cards: [winner] }));
		expect(merged.result.data.cards).toStrictEqual([winner]);
	});
});

describe('merge: events are the union by id', () => {
	const first = makeReview({ id: eventId(1), ts: T1, deviceId: DEVICE_B, seq: 2 });
	const second = makeReview({ id: eventId(2), ts: T2, deviceId: DEVICE_A, seq: 10 });
	const third = makeReview({ id: eventId(3), ts: T2, deviceId: DEVICE_B, seq: 1 });
	const fourth = makeReview({ id: eventId(4), ts: T2, deviceId: DEVICE_B, seq: 9 });

	it('keeps a shared event once, and those held by one side', () => {
		const a = makeData({ events: [first, second] });
		const b = makeData({ events: [second, third] });
		expect(merge(a, b).result.data.events).toStrictEqual([first, second, third]);
	});

	it('removes a duplicate id held twice on one side', () => {
		const a = makeData({ events: [first, first] });
		expect(merge(a, makeData()).result.data.events).toStrictEqual([first]);
	});

	it('sorts by (ts, deviceId, seq), with seq compared as a number', () => {
		const a = makeData({ events: [fourth, first] });
		const b = makeData({ events: [third, second] });
		const events = merge(a, b).result.data.events;
		expect(events).toStrictEqual([first, second, third, fourth]);
	});

	// SPEC-GAP: two different events with the same `id` break the append-only rule. Which one survives?
	// Only commutativity and "one per id" are asserted.
	it.each([
		['a different order key', makeReview({ ts: T1 }), makeReview({ ts: T2 })],
		['the same order key', makeReview({ correct: true }), makeReview({ correct: false })]
	])('stays commutative when one id arrives with different bodies: %s', (_name, x, y) => {
		const a = makeData({ events: [x] });
		const b = makeData({ events: [y] });
		expect(merge(a, b)).toStrictEqual(merge(b, a));
		expect(merge(a, b).result.data.events).toHaveLength(1);
	});

	it('keeps events of a tombstoned card', () => {
		const dead = makeData({ cards: [makeCard({ deleted: true })] });
		const merged = merge(dead, makeData({ events: [first] }));
		expect(merged.result.data.events).toStrictEqual([first]);
	});

	it('returns empty data for two empty sides', () => {
		const { result } = merge(makeData(), makeData());
		expect(result).toStrictEqual({ data: makeData(), affectedCardIds: [] });
	});
});

describe('merge: affectedCardIds', () => {
	const [c1, c2, c3] = [cardId(1), cardId(2), cardId(3)];
	const affected = (a: MergeData, b: MergeData) => merge(a, b).result.affectedCardIds;

	it('names cards with an event held by only one side, from either side', () => {
		const a = makeData({ events: [makeReview({ id: eventId(1), cardId: c1 })] });
		const b = makeData({ events: [makePretest({ id: eventId(2), cardId: c2 })] });
		expect(affected(a, b)).toStrictEqual([c1, c2]);
	});

	it('leaves out cards whose events both sides hold', () => {
		const shared = makeReview({ id: eventId(1), cardId: c1 });
		const only = makeReview({ id: eventId(2), cardId: c2 });
		const a = makeData({ events: [shared, only] });
		expect(affected(a, makeData({ events: [shared] }))).toStrictEqual([c2]);
	});

	it('names a card with one shared event and one event held by one side', () => {
		const shared = makeReview({ id: eventId(1), cardId: c1 });
		const only = makeReview({ id: eventId(2), cardId: c1 });
		const a = makeData({ events: [shared, only] });
		expect(affected(a, makeData({ events: [shared] }))).toStrictEqual([c1]);
	});

	it('is sorted with no duplicates', () => {
		const events = [c3, c1, c2, c1].map((card, i) =>
			makeReview({ id: eventId(i + 1), cardId: card })
		);
		expect(affected(makeData({ events }), makeData())).toStrictEqual([c1, c2, c3]);
	});

	it('does not add a card for an event with no cardId', () => {
		const accept = makeAcceptAdded({ id: eventId(1) });
		const noCard = makeSelfRated({ id: eventId(2) });
		expect(affected(makeData({ events: [accept, noCard] }), makeData())).toStrictEqual([]);
	});

	it('adds the card of a selfRated event that has a cardId', () => {
		const event = makeSelfRated({ id: eventId(1), cardId: c2 });
		expect(affected(makeData(), makeData({ events: [event] }))).toStrictEqual([c2]);
	});

	// SPEC-GAP: should `selfRated.missedCardIds` and `review.chosenFromCardId` count as well? Read as
	// no: only the event's own `cardId` names a card. Phase 4 replay may need this revisited.
	it('takes only the cardId field, not missedCardIds or chosenFromCardId', () => {
		const rated = makeSelfRated({ id: eventId(1), missedCardIds: [c2] });
		const review = makeReview({ id: eventId(2), cardId: c1, chosenFromCardId: c3 });
		expect(affected(makeData({ events: [rated, review] }), makeData())).toStrictEqual([c1]);
	});

	it('names a card even when its record is tombstoned or absent', () => {
		const dead = makeCard({ id: c1, deleted: true });
		const a = makeData({ cards: [dead], events: [makeReview({ id: eventId(1), cardId: c1 })] });
		const b = makeData({ events: [makeReview({ id: eventId(2), cardId: c2 })] });
		expect(affected(a, b)).toStrictEqual([c1, c2]);
	});

	it('is unaffected by content differences', () => {
		expect(affected(oneOfEach({}, 'x'), oneOfEach({ updatedAt: T2 }, 'y'))).toStrictEqual([]);
	});

	it('matches its definition on any data', () => {
		fc.assert(
			fc.property(arbTwoSides, ([a, b]) => {
				const aIds = new Set(a.events.map((event) => event.id));
				const bIds = new Set(b.events.map((event) => event.id));
				const oneSided = [
					...a.events.filter((event) => !bIds.has(event.id)),
					...b.events.filter((event) => !aIds.has(event.id))
				];
				const cards = oneSided.flatMap((event) =>
					'cardId' in event && event.cardId ? [event.cardId] : []
				);
				expect(affected(a, b)).toStrictEqual([...new Set(cards)].sort(compareText));
			}),
			RUNS
		);
	});
});

describe('merge: purity and trace', () => {
	const conflict = () => {
		const a = oneOfEach({ updatedAt: T1 }, 'x');
		const b = oneOfEach({ updatedAt: T2 }, 'y');
		a.events = [makeReview({ id: eventId(2), ts: T2 }), makeReview({ id: eventId(1), ts: T1 })];
		return [a, b] as const;
	};

	it('does not mutate its inputs', () => {
		const [a, b] = conflict();
		expect(() => merge(deepFreeze(a), deepFreeze(b))).not.toThrow();
		expect(a.events.map((event) => event.id)).toStrictEqual([eventId(2), eventId(1)]);
	});

	// SPEC-GAP: trace contents are unspecified. Only the `TraceEntry` shape and "a decision was traced"
	// are asserted (CLAUDE.md rule 17).
	it('traces its decisions as entries with a rule', () => {
		const [a, b] = conflict();
		const { trace } = merge(a, b);
		expect(trace.length).toBeGreaterThan(0);
		for (const entry of trace) expect(entry.rule).toEqual(expect.any(String));
	});

	it('returns an identical result and trace on a second call', () => {
		const [a, b] = conflict();
		expect(merge(a, b)).toStrictEqual(merge(a, b));
	});
});

describe('merge: properties', () => {
	it('is commutative, including affectedCardIds and trace', () => {
		fc.assert(
			fc.property(arbTwoSides, ([a, b]) => {
				expect(merge(a, b)).toStrictEqual(merge(b, a));
			}),
			RUNS
		);
	});

	it('is idempotent: merge(a, a) is a in canonical order, with no affected cards', () => {
		fc.assert(
			fc.property(arbTwoSides, ([a]) => {
				const { data, affectedCardIds } = merge(a, a).result;
				expect(affectedCardIds).toStrictEqual([]);
				for (const key of CONTENT_KEYS) {
					expect(data[key]).toStrictEqual(byId<ContentRecord>(a[key]));
				}
				expect(byId(data.events)).toStrictEqual(byId(a.events));
				expect(data.events).toStrictEqual([...data.events].sort(byEventKey));
				expect(merge(data, data).result.data).toStrictEqual(data);
			}),
			RUNS
		);
	});

	it('is associative on the merged data', () => {
		fc.assert(
			fc.property(arbThreeSides, ([a, b, c]) => {
				const left = merge(merge(a, b).result.data, c).result.data;
				const right = merge(a, merge(b, c).result.data).result.data;
				expect(left).toStrictEqual(right);
			}),
			RUNS
		);
	});

	it('does not depend on the order of records inside each side', () => {
		const arb = arbTwoSides.chain(([a, b]) =>
			fc.tuple(fc.constant(a), fc.constant(b), arbReordered(a), arbReordered(b))
		);
		fc.assert(
			fc.property(arb, ([a, b, a2, b2]) => {
				expect(merge(a2, b2)).toStrictEqual(merge(a, b));
			}),
			RUNS
		);
	});

	it('picks each content winner by the LWW rule, with no record lost or invented', () => {
		fc.assert(
			fc.property(arbTwoSides, ([a, b]) => {
				const { data } = merge(a, b).result;
				for (const key of CONTENT_KEYS) expectLwwOutcome(a[key], b[key], data[key]);
			}),
			RUNS
		);
	});

	it('holds the union of events, in (ts, deviceId, seq) order', () => {
		fc.assert(
			fc.property(arbTwoSides, ([a, b]) => {
				const { events } = merge(a, b).result.data;
				const union = new Map([...a.events, ...b.events].map((event) => [event.id, event]));
				expect(byId(events)).toStrictEqual(byId([...union.values()]));
				expect(events).toStrictEqual([...events].sort(byEventKey));
			}),
			RUNS
		);
	});

	it('gives an identical replay, trace included, whichever way events are imported', () => {
		fc.assert(
			fc.property(arbThreeSides, ([a, b, c]) => {
				const events = (x: MergeData, y: MergeData) => merge(x, y).result.data.events;
				const expected = replay(events(merge(a, b).result.data, c), replayCards(...CARD_POOL));
				expect(replay(events(merge(b, a).result.data, c), replayCards(...CARD_POOL))).toStrictEqual(
					expected
				);
				expect(replay(events(merge(c, b).result.data, a), replayCards(...CARD_POOL))).toStrictEqual(
					expected
				);
				expect(replay(events(a, merge(c, b).result.data), replayCards(...CARD_POOL))).toStrictEqual(
					expected
				);
			}),
			RUNS
		);
	});
});

/** Independent model of the rule: which of the two records may win. */
function allowedWinners(x: ContentRecord, y: ContentRecord): ContentRecord[] {
	const order = x.updatedAt - y.updatedAt || compareText(x.deviceId, y.deviceId);
	if (order !== 0) return [order > 0 ? x : y];
	if (Boolean(x.deleted) !== Boolean(y.deleted)) return [x.deleted ? x : y];
	return [x, y];
}

function expectLwwOutcome(
	a: readonly ContentRecord[],
	b: readonly ContentRecord[],
	merged: readonly ContentRecord[]
): void {
	const ids = [...new Set([...a, ...b].map((record) => record.id))].sort(compareText);
	expect(merged.map((record) => record.id)).toStrictEqual(ids);
	for (const record of merged) {
		const x = a.find((other) => other.id === record.id);
		const y = b.find((other) => other.id === record.id);
		const allowed = x && y ? allowedWinners(x, y) : [x ?? y];
		expect(allowed).toContainEqual(record);
	}
}
