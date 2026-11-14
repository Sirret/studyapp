import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ContentStore, type ContentBatch } from '#lib/db/repos/content-store.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { createDb, type SnowpackDb } from '#lib/db/schema.ts';
import type { CourseId, DeviceId, NoteId } from '#lib/db/schemas/common.ts';

const NOW = 1_000;
const LATER = 2_000;

describe('ContentStore', () => {
	let db: SnowpackDb;
	let store: ContentStore;
	let deviceId: DeviceId;
	let now: number;
	let dbCount = 0;

	beforeEach(async () => {
		dbCount += 1;
		now = NOW;
		db = createDb(`store-test-${dbCount}`);
		const device = new DeviceRepo(db, randomUUID);
		store = new ContentStore(db, {
			clock: () => now,
			newId: randomUUID,
			getDeviceId: () => device.getDeviceId()
		});
		deviceId = await store.getDeviceId();
	});

	afterEach(async () => {
		await db.delete();
	});

	function batch(): ContentBatch {
		const courseId = randomUUID() as CourseId;
		const topic = store.topics.draft(
			{ courseId, name: 'A', order: 0, placement: 'unread', priority: 'normal' },
			deviceId
		);
		const note = store.notes.draft(
			{
				courseId,
				topicId: topic.id,
				order: 0,
				priority: 'normal',
				tags: [],
				generated: false,
				check: false,
				accept: {},
				type: 'scenario',
				payload: { situation: 'a', answer: 'b' }
			},
			deviceId
		);
		const card = store.cards.draft(
			{ noteId: note.id, courseId, variant: 'fwd', path: ['scenario'], suspended: false },
			deviceId
		);
		return { media: [], topics: [topic], chunks: [], notes: [note], cards: [card] };
	}

	it('writes every record in a batch', async () => {
		await store.writeBatch(batch());
		expect(await store.topics.list()).toHaveLength(1);
		expect(await store.notes.list()).toHaveLength(1);
		expect(await store.cards.list()).toHaveLength(1);
	});

	it('writes nothing when one record fails', async () => {
		const first = batch();
		await store.writeBatch(first);
		const second = batch();
		// A card ID already in use makes the batch's final write fail.
		const [usedCard] = first.cards;
		if (!usedCard) throw new Error('No card');
		second.cards.push({ ...usedCard, noteId: randomUUID() as NoteId });
		await expect(store.writeBatch(second)).rejects.toThrow();
		expect(await store.topics.list()).toHaveLength(1);
		expect(await store.notes.list()).toHaveLength(1);
		expect(await store.cards.list()).toHaveLength(1);
	});

	it('changes an existing topic through bulkPut', async () => {
		const first = batch();
		await store.writeBatch(first);
		const [topic] = first.topics;
		if (!topic) throw new Error('No topic');
		now = LATER;
		const changed = store.topics.draftChange(topic, { placement: 'read' }, deviceId);
		await store.writeBatch({ media: [], topics: [changed], chunks: [], notes: [], cards: [] });
		const stored = await store.topics.get(topic.id);
		expect(stored).toMatchObject({ placement: 'read', createdAt: NOW, updatedAt: LATER });
	});

	it('draft sets what the repository owns, and validates', () => {
		const [topic] = batch().topics;
		expect(topic).toMatchObject({ createdAt: NOW, updatedAt: NOW, deviceId });
		expect(() =>
			store.topics.draft(
				{
					courseId: randomUUID() as CourseId,
					name: '',
					order: 0,
					placement: 'unread',
					priority: 'normal'
				},
				deviceId
			)
		).toThrow();
	});

	it('gives a new card empty scheduling caches', () => {
		const [card] = batch().cards;
		expect(card).toMatchObject({ status: 'unseen', fsrs: null, pathStep: 0 });
	});

	it('putBatch changes, adds and tombstones records across tables', async () => {
		const first = batch();
		await store.writeBatch(first);
		const [note] = first.notes;
		const [card] = first.cards;
		if (!note || !card) throw new Error('No note or card');
		now = LATER;
		const added = store.cards.draft(
			{ noteId: note.id, courseId: card.courseId, variant: 'rev', path: ['mc'], suspended: false },
			deviceId
		);
		await store.putBatch({
			notes: [store.notes.draftChange(note, { check: true }, deviceId)],
			cards: [store.cards.draftDelete(card, deviceId), added]
		});
		expect(await store.notes.get(note.id)).toMatchObject({ check: true, updatedAt: LATER });
		expect((await store.cards.listByNote(note.id)).map((c) => c.id)).toEqual([added.id]);
		expect(await db.cards.get(card.id)).toMatchObject({ deleted: true, updatedAt: LATER });
	});

	it('putBatch writes nothing when one record fails', async () => {
		const first = batch();
		await store.writeBatch(first);
		const [note] = first.notes;
		if (!note) throw new Error('No note');
		const changed = store.notes.draftChange(note, { check: true }, deviceId);
		const broken = { ...store.cards.draft(first.cards[0] as never, deviceId), id: undefined };
		await expect(store.putBatch({ notes: [changed], cards: [broken as never] })).rejects.toThrow();
		expect((await store.notes.get(note.id))?.check).toBe(false);
	});
});
