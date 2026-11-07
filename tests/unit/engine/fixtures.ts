import fc from 'fast-check';
import { EMPTY_CARD_CACHES } from '#lib/db/schemas/card.ts';
import type { Card } from '#lib/db/schemas/card.ts';
import type {
	CardId,
	ChunkId,
	CourseId,
	DeviceId,
	EventId,
	MediaId,
	Meta,
	NoteId,
	SessionId,
	TopicId
} from '#lib/db/schemas/common.ts';
import type { Chunk, Course, Media, Topic } from '#lib/db/schemas/course.ts';
import type { ReviewEvent, StudyEvent } from '#lib/db/schemas/event.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import type { LwwRecord, MergeData } from '#lib/engine/merge.ts';

type SelfRatedEvent = Extract<StudyEvent, { type: 'selfRated' }>;
type PretestEvent = Extract<StudyEvent, { type: 'pretest' }>;
type AcceptAddedEvent = Extract<StudyEvent, { type: 'acceptAdded' }>;

export const NUM_RUNS = 100;

/** A valid v4 UUID. A higher `n` always sorts later. */
export const uuid = (n: number): string =>
	`00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

export const courseId = (n: number) => uuid(n) as CourseId;
export const topicId = (n: number) => uuid(n) as TopicId;
export const chunkId = (n: number) => uuid(n) as ChunkId;
export const noteId = (n: number) => uuid(n) as NoteId;
export const cardId = (n: number) => uuid(n) as CardId;
export const mediaId = (n: number) => uuid(n) as MediaId;
export const eventId = (n: number) => uuid(n) as EventId;
export const deviceId = (n: number) => uuid(n) as DeviceId;

export const DEVICE_A = deviceId(0xa);
export const DEVICE_B = deviceId(0xb);
export const SESSION = uuid(0x5e) as SessionId;
export const T1 = 1_000;
export const T2 = 2_000;

export function makeCourse(overrides: Partial<Course> = {}): Course {
	return {
		id: courseId(1),
		createdAt: T1,
		updatedAt: T1,
		deviceId: DEVICE_A,
		name: 'course',
		status: 'active',
		examFormat: 'recall',
		color: 'sky',
		...overrides
	};
}

export function makeTopic(overrides: Partial<Topic> = {}): Topic {
	return {
		id: topicId(1),
		createdAt: T1,
		updatedAt: T1,
		deviceId: DEVICE_A,
		courseId: courseId(1),
		name: 'topic',
		order: 0,
		placement: 'unread',
		priority: 'normal',
		...overrides
	};
}

export function makeChunk(overrides: Partial<Chunk> = {}): Chunk {
	return {
		id: chunkId(1),
		createdAt: T1,
		updatedAt: T1,
		deviceId: DEVICE_A,
		topicId: topicId(1),
		order: 0,
		text: 'chunk',
		words: 1,
		source: 'notes',
		...overrides
	};
}

export function makeNote(overrides: Partial<Meta> & { id?: NoteId } = {}, meaning = 'm'): Note {
	return {
		id: noteId(1),
		createdAt: T1,
		updatedAt: T1,
		deviceId: DEVICE_A,
		courseId: courseId(1),
		topicId: topicId(1),
		priority: 'normal',
		tags: [],
		generated: false,
		check: false,
		accept: {},
		type: 'keyterm',
		payload: { term: 't', meaning },
		...overrides
	};
}

export function makeCard(overrides: Partial<Card> = {}): Card {
	return {
		...EMPTY_CARD_CACHES,
		accuracy: { ...EMPTY_CARD_CACHES.accuracy },
		id: cardId(1),
		createdAt: T1,
		updatedAt: T1,
		deviceId: DEVICE_A,
		noteId: noteId(1),
		courseId: courseId(1),
		variant: 'v',
		path: ['cloze'],
		suspended: false,
		...overrides
	};
}

export function makeMedia(overrides: Partial<Media> = {}): Media {
	const hash = overrides.hash ?? 'a'.repeat(64);
	return {
		id: mediaId(1),
		createdAt: T1,
		updatedAt: T1,
		deviceId: DEVICE_A,
		hash,
		mime: 'image/webp',
		width: 1,
		height: 1,
		bytes: 1,
		blob: new Blob([hash]),
		...overrides
	};
}

export function makeReview(overrides: Partial<ReviewEvent> = {}): ReviewEvent {
	return {
		id: eventId(1),
		ts: T1,
		deviceId: DEVICE_A,
		seq: 1,
		type: 'review',
		cardId: cardId(1),
		sessionId: SESSION,
		mode: 'longterm',
		kind: 'cloze',
		weight: 'full',
		firstAttempt: true,
		correct: true,
		responseMs: 100,
		credited: true,
		...overrides
	};
}

export function makePretest(overrides: Partial<PretestEvent> = {}): PretestEvent {
	return {
		id: eventId(1),
		ts: T1,
		deviceId: DEVICE_A,
		seq: 1,
		type: 'pretest',
		cardId: cardId(1),
		sessionId: SESSION,
		skipped: false,
		responseMs: 100,
		...overrides
	};
}

export function makeSelfRated(overrides: Partial<SelfRatedEvent> = {}): SelfRatedEvent {
	return {
		id: eventId(1),
		ts: T1,
		deviceId: DEVICE_A,
		seq: 1,
		type: 'selfRated',
		noteId: noteId(1),
		sessionId: SESSION,
		kind: 'flip',
		...overrides
	};
}

export function makeAcceptAdded(overrides: Partial<AcceptAddedEvent> = {}): AcceptAddedEvent {
	return {
		id: eventId(1),
		ts: T1,
		deviceId: DEVICE_A,
		seq: 1,
		type: 'acceptAdded',
		noteId: noteId(1),
		variant: 'v',
		value: 'x',
		...overrides
	};
}

export function makeData(overrides: Partial<MergeData> = {}): MergeData {
	return {
		courses: [],
		topics: [],
		chunks: [],
		notes: [],
		cards: [],
		media: [],
		events: [],
		...overrides
	};
}

/** One record in every content collection, all sharing `meta` and carrying `label` as content. */
export function oneOfEach(meta: Partial<Meta>, label: string): MergeData {
	return makeData({
		courses: [makeCourse({ ...meta, name: label })],
		topics: [makeTopic({ ...meta, name: label })],
		chunks: [makeChunk({ ...meta, text: label })],
		notes: [makeNote(meta, label)],
		cards: [makeCard({ ...meta, variant: label })],
		media: [makeMedia({ ...meta, fileName: label })]
	});
}

export const CONTENT_KEYS = ['courses', 'topics', 'chunks', 'notes', 'cards', 'media'] as const;

export type ContentRecord = LwwRecord & { id: string };

/** Code-unit order, written here so the tests don't lean on the module under test. */
export function compareText(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

export function byId<T extends { id: string }>(records: readonly T[]): T[] {
	return [...records].sort((a, b) => compareText(a.id, b.id));
}

/** The `(ts, deviceId, seq)` order, independent of `compareEvents`. Stable sort keeps key ties. */
export function byEventKey(a: StudyEvent, b: StudyEvent): number {
	return a.ts - b.ts || compareText(a.deviceId, b.deviceId) || a.seq - b.seq;
}

/** Freezes plain objects and arrays, so a mutating implementation throws. */
export function deepFreeze<T>(value: T): T {
	if (typeof value === 'object' && value !== null && !(value instanceof Blob)) {
		Object.values(value).forEach(deepFreeze);
		Object.freeze(value);
	}
	return value;
}

const arbMeta: fc.Arbitrary<Meta> = fc
	.record({
		createdAt: fc.constantFrom(1, 2),
		updatedAt: fc.constantFrom(T1, T2),
		deviceId: fc.constantFrom(DEVICE_A, DEVICE_B),
		tombstone: fc.boolean()
	})
	.map(({ tombstone, ...meta }) => (tombstone ? { ...meta, deleted: true as const } : meta));

const arbSlot = fc.constantFrom(1, 2, 3);
const arbLabel = fc.constantFrom('x', 'y', 'z');

/** Few ids, times and devices, so records collide and tie often. */
const arbContent = fc.record({ meta: arbMeta, slot: arbSlot, label: arbLabel });
type Content = { meta: Meta; slot: number; label: string };

function arbSide<T extends { id: string }>(build: (content: Content) => T): fc.Arbitrary<T[]> {
	return fc.uniqueArray(arbContent.map(build), { selector: (r) => r.id, maxLength: 3 });
}

const arbCards = fc.uniqueArray(
	fc
		.record({
			content: arbContent,
			suspended: fc.boolean(),
			n: fc.constantFrom(0, 1),
			status: fc.constantFrom('unseen' as const, 'learning' as const)
		})
		.map(({ content: { meta, slot, label }, suspended, n, status }) =>
			makeCard({
				...meta,
				id: cardId(slot),
				variant: label,
				suspended,
				status,
				accuracy: { n, correct: 0 }
			})
		),
	{ selector: (card) => card.id, maxLength: 3 }
);

export const CARD_POOL = [cardId(1), cardId(2), cardId(3), cardId(4)];

const arbEventBase = fc.record({
	id: fc.integer({ min: 1, max: 60 }).map(eventId),
	ts: fc.constantFrom(T1, T2),
	deviceId: fc.constantFrom(DEVICE_A, DEVICE_B),
	seq: fc.constantFrom(1, 2, 10)
});
const arbCardId = fc.constantFrom(...CARD_POOL);

const arbReview = fc
	.record({
		base: arbEventBase,
		cardId: arbCardId,
		weight: fc.constantFrom('full' as const, 'recognition' as const, 'none' as const),
		mode: fc.constantFrom('acquisition' as const, 'cram' as const, 'longterm' as const),
		firstAttempt: fc.boolean(),
		correct: fc.boolean(),
		credited: fc.boolean()
	})
	.map(({ base, ...rest }) => makeReview({ ...base, ...rest }));

const arbPretest = fc
	.record({ base: arbEventBase, cardId: arbCardId, skipped: fc.boolean() })
	.map(({ base, ...rest }) => makePretest({ ...base, ...rest }));

const arbSelfRated = fc
	.record({ base: arbEventBase, cardId: fc.option(arbCardId, { nil: undefined }) })
	.map(({ base, cardId: card }) => makeSelfRated({ ...base, ...(card ? { cardId: card } : {}) }));

const arbAcceptAdded = arbEventBase.map((base) => makeAcceptAdded(base));

export const arbEvent: fc.Arbitrary<StudyEvent> = fc.oneof(
	{ arbitrary: arbReview, weight: 4 },
	{ arbitrary: arbPretest, weight: 1 },
	{ arbitrary: arbSelfRated, weight: 1 },
	{ arbitrary: arbAcceptAdded, weight: 1 }
);

/** Unique ids, but `(ts, deviceId, seq)` collides often. */
export const arbEvents = fc.uniqueArray(arbEvent, { selector: (event) => event.id, maxLength: 10 });

export function arbShuffled<T>(items: readonly T[]): fc.Arbitrary<T[]> {
	return fc.shuffledSubarray([...items], { minLength: items.length, maxLength: items.length });
}

const hashOf = (label: string): string => (label === 'x' ? 'a' : 'b').repeat(64);

/** A device's data. Sides drawn from one pool agree on any event id they share. */
function arbData(pool: StudyEvent[]): fc.Arbitrary<MergeData> {
	return fc.record({
		courses: arbSide(({ meta, slot, label }) =>
			makeCourse({ ...meta, id: courseId(slot), name: label })
		),
		topics: arbSide(({ meta, slot, label }) =>
			makeTopic({ ...meta, id: topicId(slot), name: label })
		),
		chunks: arbSide(({ meta, slot, label }) =>
			makeChunk({ ...meta, id: chunkId(slot), text: label })
		),
		notes: arbSide(({ meta, slot, label }) => makeNote({ ...meta, id: noteId(slot) }, label)),
		cards: arbCards,
		// SPEC-GAP: two media in a full tie that differ only in `blob` can't be told apart by a pure
		// sync function, and `toStrictEqual` can't see Blob contents. Is a same-hash tie out of scope?
		// Read as yes: `blob` always follows `hash` here.
		media: arbSide(({ meta, slot, label }) =>
			makeMedia({ ...meta, id: mediaId(slot), fileName: label, hash: hashOf(label) })
		),
		events: fc.shuffledSubarray(pool)
	});
}

export const arbTwoSides: fc.Arbitrary<[MergeData, MergeData]> = arbEvents.chain((pool) =>
	fc.tuple(arbData(pool), arbData(pool))
);

export const arbThreeSides: fc.Arbitrary<[MergeData, MergeData, MergeData]> = arbEvents.chain(
	(pool) => fc.tuple(arbData(pool), arbData(pool), arbData(pool))
);

/** The same data with every collection in a different order. */
export function arbReordered(data: MergeData): fc.Arbitrary<MergeData> {
	return fc.record({
		courses: arbShuffled(data.courses),
		topics: arbShuffled(data.topics),
		chunks: arbShuffled(data.chunks),
		notes: arbShuffled(data.notes),
		cards: arbShuffled(data.cards),
		media: arbShuffled(data.media),
		events: arbShuffled(data.events)
	});
}

export type LabelledRecord = LwwRecord & { label: string; tags: string[] };

/** Bare LWW records with frequent ties, including nested differences. */
export const arbLabelled: fc.Arbitrary<LabelledRecord> = fc
	.record({
		updatedAt: fc.constantFrom(T1, T2),
		deviceId: fc.constantFrom(DEVICE_A, DEVICE_B),
		tombstone: fc.boolean(),
		label: arbLabel,
		tags: fc.constantFrom(['p', 'q'], ['q', 'p'], [])
	})
	.map(({ tombstone, tags, ...rest }) => {
		const record = { ...rest, tags: [...tags] };
		return tombstone ? { ...record, deleted: true as const } : record;
	});
