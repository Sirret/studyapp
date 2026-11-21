import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { NoteId, TopicId } from '#lib/db/schemas/common.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import { Logger } from '#lib/log/logger.ts';
import { DiagramService } from '#lib/services/diagram-service.ts';
import type { ImageEncoder } from '#lib/services/import-service.ts';
import { NoteRegenWriter } from '#lib/services/note-regen.ts';
import { OcclusionService, type OcclusionEdit } from '#lib/services/occlusion-service.ts';
import { StorageGuard } from '#lib/services/storage-guard.ts';
import { setupCardEnv, type CardEnv } from './card-list-fixtures.ts';

/**
 * Phase 6 step 7: the figure editors' services keep card IDs across edits (rule 7), tombstone
 * only what an edit removes, and store new images once.
 *
 * @see BUILD_PLAN §7; WIP step 7
 */

const REPLY = `@deck Storage
@diagram stack DBMS layers
Query processor
Storage manager
Disk storage
@diagram flow Query processing
SQL query -> Parser : parsed into
Parser -> Optimizer
@occlusion buffer.png
box: Buffer pool
box: Disk
@end`;

const encoder: ImageEncoder = {
	encode: async (source) => ({
		ok: true,
		value: { blob: source, width: 40, height: 20, mime: 'image/webp' }
	})
};

const persist = { persisted: async () => false, persist: async () => true };

let env: CardEnv;
let occlusion: OcclusionService;
let diagrams: DiagramService;
let persistCalls: number;

beforeEach(async () => {
	env = await setupCardEnv();
	const logger = new Logger({ sink: { append: async () => {} }, clock: () => 1 });
	const writer = new NoteRegenWriter(env.store, env.replay, logger);
	persistCalls = 0;
	const storage = {
		...persist,
		persist: async () => {
			persistCalls += 1;
			return true;
		}
	};
	occlusion = new OcclusionService(
		env.store,
		writer,
		encoder,
		new StorageGuard(storage, logger),
		logger
	);
	diagrams = new DiagramService(env.store, writer, randomUUID, logger);
	await env.importText(REPLY, ['buffer.png']);
});

async function noteOf(type: Note['type'], text = ''): Promise<Note> {
	const found = (await env.notes()).find(
		(note) => note.type === type && JSON.stringify(note.payload).includes(text)
	);
	if (!found) throw new Error(`no ${type} note`);
	return found;
}

async function liveCards(noteId: NoteId) {
	return env.store.cards.listByNote(noteId);
}

const box = (label: string, x = 0.1) => ({ id: randomUUID(), x, y: 0.1, w: 0.2, h: 0.1, label });

describe('OcclusionService', () => {
	it('loads an imported image note with its unplaced labels and defaults', async () => {
		const note = await noteOf('occlusion');
		const doc = await occlusion.load(note.id);
		expect(doc?.edit).toEqual({
			boxes: [],
			unplaced: ['Buffer pool', 'Disk'],
			hide: 'one',
			title: ''
		});
		expect(doc?.image.width).toBe(40);
		expect(doc?.image.fileName).toBe('buffer.png');
		expect(await occlusion.load((await noteOf('diagram')).id)).toBeNull();
	});

	it('saves boxes: one card per named box, clamped onto the image; unnamed boxes make none', async () => {
		const note = await noteOf('occlusion');
		const pool = { ...box('  Buffer pool '), x: 0.95 };
		const edit: OcclusionEdit = {
			boxes: [pool, box('', 0.5)],
			unplaced: ['Disk'],
			hide: 'all',
			title: ' Buffer '
		};
		const saved = await occlusion.save(note.id, edit);
		expect(saved).toEqual({ ok: true, value: { cards: 1 } });
		const stored = (await env.store.notes.get(note.id)) as Extract<Note, { type: 'occlusion' }>;
		expect(stored.payload.boxes[0]).toMatchObject({ id: pool.id, label: 'Buffer pool', x: 0.8 });
		expect(stored.payload).toMatchObject({ hide: 'all', title: 'Buffer', unplaced: ['Disk'] });
		expect((await liveCards(note.id)).map((c) => c.variant)).toEqual([`box:${pool.id}`]);
	});

	it('keeps a box card when the box moves or is renamed; deleting a box tombstones only its card', async () => {
		const note = await noteOf('occlusion');
		const a = box('Buffer pool');
		const b = box('Disk', 0.5);
		await occlusion.save(note.id, { boxes: [a, b], unplaced: [], hide: 'one', title: '' });
		const before = await liveCards(note.id);
		const cardOf = (id: string) => before.find((c) => c.variant === `box:${id}`)?.id;
		await occlusion.save(note.id, {
			boxes: [{ ...a, x: 0.3, label: 'Pool' }, b].reverse(),
			unplaced: [],
			hide: 'one',
			title: ''
		});
		const moved = await liveCards(note.id);
		expect(moved.map((c) => c.id).sort()).toEqual(before.map((c) => c.id).sort());
		await occlusion.save(note.id, { boxes: [a], unplaced: [], hide: 'one', title: '' });
		const after = await liveCards(note.id);
		expect(after.map((c) => c.id)).toEqual([cardOf(a.id)]);
		const removed = await env.db.cards.get(cardOf(b.id) ?? '');
		expect(removed?.deleted).toBe(true);
	});

	it('creates an image note with no boxes, stores the image once and asks for persistence once', async () => {
		const topicId = (await env.topicIds())[0] as TopicId;
		const blob = new Blob(['new picture'], { type: 'image/png' });
		const first = await occlusion.create(topicId, null, { name: 'cpu.png', blob });
		const second = await occlusion.create(topicId, null, { name: 'cpu copy.png', blob });
		if (!first.ok || !second.ok) throw new Error('create failed');
		const a = await occlusion.load(first.value);
		const b = await occlusion.load(second.value);
		expect(a?.edit.boxes).toEqual([]);
		expect(a?.image.mediaId).toBe(b?.image.mediaId);
		expect(await liveCards(first.value)).toEqual([]);
		expect(persistCalls).toBe(1);
	});

	it('reuses an image imported earlier and reports encode failures', async () => {
		const topicId = (await env.topicIds())[0] as TopicId;
		const imported = await occlusion.load((await noteOf('occlusion')).id);
		const again = await occlusion.create(topicId, null, {
			name: 'buffer.png',
			blob: new Blob(['buffer.png'], { type: 'image/png' })
		});
		if (!again.ok) throw new Error('create failed');
		expect((await occlusion.load(again.value))?.image.mediaId).toBe(imported?.image.mediaId);
		expect(persistCalls).toBe(0);
		const broken = new OcclusionService(
			env.store,
			new NoteRegenWriter(
				env.store,
				env.replay,
				new Logger({ sink: { append: async () => {} }, clock: () => 1 })
			),
			{ encode: async () => ({ ok: false, error: 'not an image' }) },
			new StorageGuard(undefined, new Logger({ sink: { append: async () => {} }, clock: () => 1 })),
			new Logger({ sink: { append: async () => {} }, clock: () => 1 })
		);
		const failed = await broken.create(topicId, null, { name: 'x.txt', blob: new Blob(['x']) });
		expect(failed).toEqual({ ok: false, error: 'x.txt: not an image' });
	});

	it('maps a full device to the out-of-space message and writes nothing', async () => {
		const topicId = (await env.topicIds())[0] as TopicId;
		const notesBefore = (await env.notes()).length;
		env.store.putBatch = async () => {
			throw new DOMException('full', 'QuotaExceededError');
		};
		const result = await occlusion.create(topicId, null, {
			name: 'big.png',
			blob: new Blob(['big'], { type: 'image/png' })
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/out of space/);
		expect((await env.notes()).length).toBe(notesBefore);
	});
});

describe('DiagramService', () => {
	it('loads a diagram as editor text with its nodes', async () => {
		const note = await noteOf('diagram', 'Query processing');
		const doc = await diagrams.load(note.id);
		expect(doc?.kind).toBe('flow');
		expect(doc?.text).toBe('SQL query -> Parser : parsed into\nParser -> Optimizer');
		expect(doc?.nodes.map((n) => n.label)).toEqual(['SQL query', 'Parser', 'Optimizer']);
	});

	it('a text edit keeps unchanged cards; a dropped arrow tombstones only its card', async () => {
		const note = await noteOf('diagram', 'Query processing');
		const before = await liveCards(note.id);
		const saved = await diagrams.saveText(
			note.id,
			'Parser -> Optimizer\nSQL query -> Parser : read by'
		);
		expect(saved.ok).toBe(true);
		const reordered = await liveCards(note.id);
		expect(reordered.map((c) => c.id).sort()).toEqual(before.map((c) => c.id).sort());
		await diagrams.saveText(note.id, 'SQL query -> Parser');
		const after = await liveCards(note.id);
		const gone = before.filter((c) => !after.some((a) => a.id === c.id));
		expect(gone.map((c) => c.variant)).toHaveLength(2); // the arrow and the Optimizer node
		expect(gone.every((c) => c.variant.startsWith('edge:') || c.variant.startsWith('node:'))).toBe(
			true
		);
		expect(after.every((c) => before.some((b) => b.id === c.id))).toBe(true);
	});

	it('renaming a node keeps its ID and card', async () => {
		const note = await noteOf('diagram', 'DBMS layers');
		const doc = await diagrams.load(note.id);
		const disk = doc?.nodes.find((n) => n.label === 'Disk storage');
		if (!disk) throw new Error('no node');
		const before = await liveCards(note.id);
		const renamed = await diagrams.rename(note.id, disk.id, 'Disk');
		expect(renamed.ok).toBe(true);
		expect((await diagrams.load(note.id))?.nodes.find((n) => n.id === disk.id)?.label).toBe('Disk');
		expect((await liveCards(note.id)).map((c) => c.id).sort()).toEqual(
			before.map((c) => c.id).sort()
		);
		const clash = await diagrams.rename(note.id, disk.id, 'storage manager');
		expect(clash.ok).toBe(false);
	});

	it('an unreadable line saves nothing and reports the line', async () => {
		const note = await noteOf('diagram', 'Query processing');
		const result = await diagrams.saveText(note.id, 'SQL query -> Parser\nnot an arrow');
		expect(result).toEqual({
			ok: false,
			error: {
				message: 'Some lines could not be read.',
				lines: [{ line: 2, message: expect.any(String) }]
			}
		});
		expect((await diagrams.load(note.id))?.text).toBe(
			'SQL query -> Parser : parsed into\nParser -> Optimizer'
		);
	});

	it('previews text with a layout, writing nothing', () => {
		const preview = diagrams.preview('stack', 'Application\nTransport\nNetwork');
		expect(preview.errors).toEqual([]);
		expect(preview.nodes.map((n) => n.label)).toEqual(['Application', 'Transport', 'Network']);
		expect(Object.keys(preview.layout?.nodes ?? {})).toHaveLength(3);
		expect(diagrams.preview('stack', 'Only one').layout).toBeNull();
	});

	it('creates a diagram note with its cards', async () => {
		const topicId = (await env.topicIds())[0] as TopicId;
		const created = await diagrams.create(topicId, null, {
			kind: 'stack',
			name: 'OSI',
			text: 'Application\nTransport'
		});
		if (!created.ok) throw new Error('create failed');
		const variants = (await liveCards(created.value)).map((c) => c.variant);
		expect(variants).toContain('layers');
		expect(variants.filter((v) => v.startsWith('layer:'))).toHaveLength(2);
		expect(
			(await diagrams.create(topicId, null, { kind: 'flow', name: ' ', text: 'A -> B' })).ok
		).toBe(false);
	});
});

describe('CardListService.editorHref', () => {
	it('links image and diagram notes to their editors, and nothing else', async () => {
		const image = await noteOf('occlusion');
		const flow = await noteOf('diagram', 'Query processing');
		const href = (note: Note) =>
			env.cardList.editorHref({ courseId: note.courseId, noteId: note.id, type: note.type });
		expect(href(image)).toBe(`/course/${env.courseId}/image/${image.id}`);
		expect(href(flow)).toBe(`/course/${env.courseId}/diagram/${flow.id}`);
		expect(
			env.cardList.editorHref({ courseId: env.courseId, noteId: image.id, type: 'keyterm' })
		).toBeNull();
	});
});
