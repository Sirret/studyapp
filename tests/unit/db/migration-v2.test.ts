import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { createDb, type SnowpackDb } from '#lib/db/schema.ts';
import { ChunkSchema, TopicSchema } from '#lib/db/schemas/course.ts';
import { NoteSchema } from '#lib/db/schemas/note.ts';
import { chunkId, makeChunk, makeNote, makeTopic, noteId } from '../engine/fixtures.ts';

/**
 * Dexie version 2 (Import v2): a database written by version 1 opens with its legacy `@tag`
 * names as section titles, and every old record is still valid.
 *
 * @see DATA_MODEL §3.3 ("Dexie version 2") and Decisions log (Import v2: migration)
 */

const V1_STORES = {
	courses: 'id, status, examDate, updatedAt',
	topics: 'id, courseId, [courseId+order], updatedAt',
	chunks: 'id, topicId, [topicId+order], updatedAt',
	notes: 'id, courseId, topicId, chunkId, type, updatedAt',
	cards: 'id, noteId, courseId, status, due, updatedAt',
	events: 'id, ts, cardId, sessionId, type, [cardId+ts]',
	media: 'id, hash',
	sessions: 'id, startedAt, mode',
	kv: 'key',
	logs: '++seq, ts, level, area'
};

let name = '';
let opened: SnowpackDb | undefined;

afterEach(async () => {
	opened?.close();
	await Dexie.delete(name);
});

/** Writes records with a version-1 database, then closes it. */
async function writeV1(records: {
	topics: unknown[];
	chunks: unknown[];
	notes: unknown[];
}): Promise<void> {
	const v1 = new Dexie(name);
	v1.version(1).stores(V1_STORES);
	await v1.table('topics').bulkAdd(records.topics);
	await v1.table('chunks').bulkAdd(records.chunks);
	await v1.table('notes').bulkAdd(records.notes);
	v1.close();
}

describe('Dexie v2 migration', () => {
	it("titles each legacy section with its notes' first @tag, in note order", async () => {
		name = `migrate-${randomUUID()}`;
		const legacyTopic = { ...makeTopic() } as Record<string, unknown>;
		delete legacyTopic.from;
		await writeV1({
			topics: [legacyTopic],
			chunks: [makeChunk({ id: chunkId(1) }), makeChunk({ id: chunkId(2), order: 1 })],
			notes: [
				{ ...makeNote({ id: noteId(2) }), order: 1, tags: ['Second tag'], chunkId: chunkId(1) },
				{ ...makeNote({ id: noteId(1) }), order: 0, tags: ['Malware'], chunkId: chunkId(1) },
				{ ...makeNote({ id: noteId(3) }), order: 2, tags: [], chunkId: chunkId(2) }
			]
		});
		opened = createDb(name);
		const chunks = await opened.chunks.orderBy('[topicId+order]').toArray();
		expect(chunks.map((chunk) => chunk.title)).toStrictEqual(['Malware', undefined]);
	});

	it('keeps every old record valid under the new schemas', async () => {
		name = `migrate-${randomUUID()}`;
		const legacyTopic = { ...makeTopic() } as Record<string, unknown>;
		delete legacyTopic.from;
		await writeV1({
			topics: [legacyTopic],
			chunks: [makeChunk({ id: chunkId(1) })],
			notes: [{ ...makeNote(), tags: ['t'], chunkId: chunkId(1) }]
		});
		opened = createDb(name);
		for (const topic of await opened.topics.toArray()) TopicSchema.parse(topic);
		for (const chunk of await opened.chunks.toArray()) ChunkSchema.parse(chunk);
		for (const note of await opened.notes.toArray()) NoteSchema.parse(note);
		expect(opened.verno).toBe(3);
	});

	it('leaves a section that already has a title alone', async () => {
		name = `migrate-${randomUUID()}`;
		await writeV1({
			topics: [makeTopic()],
			chunks: [makeChunk({ id: chunkId(1), title: 'Kept' })],
			notes: [{ ...makeNote(), tags: ['Other'], chunkId: chunkId(1) }]
		});
		opened = createDb(name);
		expect((await opened.chunks.get(chunkId(1)))?.title).toBe('Kept');
	});
});
