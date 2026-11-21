import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CourseId } from '#lib/db/schemas/common.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import { ContentStore } from '#lib/db/repos/content-store.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { createDb, type SnowpackDb } from '#lib/db/schema.ts';
import { Logger } from '#lib/log/logger.ts';
import {
	ImportService,
	type ImageEncoder,
	type ImageSource,
	type ImportPreview
} from '#lib/services/import-service.ts';

/**
 * Phase 6 step 6: images and diagrams through import (zip names, `box:` lines, missing images,
 * re-import of image notes).
 *
 * @see Decisions log "Phase 6 Q9", "Phase 6 Q10–Q13", "Phase 6 step 6"
 */

const GOLDEN = 'tests/golden/import';
const encoder: ImageEncoder = {
	encode: async (source) => ({
		ok: true,
		value: { blob: source, width: 40, height: 20, mime: 'image/webp' }
	})
};

/** Rewrites each UUID to `id1`, `id2`… by first appearance, so output can be compared. */
function stableIds(value: unknown): unknown {
	const seen = new Map<string, string>();
	const json = JSON.stringify(value).replace(
		/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
		(id) => {
			if (!seen.has(id)) seen.set(id, `id${seen.size + 1}`);
			return seen.get(id) ?? id;
		}
	);
	return JSON.parse(json);
}

describe('ImportService with images and diagrams', () => {
	let db: SnowpackDb;
	let store: ContentStore;
	let service: ImportService;
	let courseId: CourseId;
	let dbCount = 0;

	beforeEach(async () => {
		dbCount += 1;
		db = createDb(`import-figures-${dbCount}`);
		const device = new DeviceRepo(db, randomUUID);
		store = new ContentStore(db, {
			clock: () => 5_000,
			newId: randomUUID,
			getDeviceId: () => device.getDeviceId()
		});
		const logger = new Logger({ sink: { append: async () => {} }, clock: () => 5_000 });
		service = new ImportService(store, encoder, randomUUID, logger);
		courseId = (await service.createCourse('Databases')).id;
	});

	afterEach(async () => {
		await db.delete();
	});

	const image = (name: string, bytes = name): ImageSource => ({
		name,
		blob: new Blob([bytes], { type: 'image/png' })
	});

	async function preview(text: string, sources: ImageSource[] = []): Promise<ImportPreview> {
		const { images, errors } = await service.prepareImages(sources);
		expect(errors).toEqual([]);
		return service.preview(courseId, text, images);
	}

	async function commit(text: string, sources: ImageSource[] = []): Promise<ImportPreview> {
		const shown = await preview(text, sources);
		const result = await service.commit(courseId, shown, new Map());
		if (!result.ok) throw new Error(result.error);
		return shown;
	}

	/** What a commit stored: notes with their image file names and cards. */
	async function storedNotes(): Promise<unknown[]> {
		const media = await store.media.list();
		const fileOf = (id: unknown) => `media:${media.find((m) => m.id === id)?.fileName}`;
		const notes = (await store.notes.list()).sort((a, b) => a.order - b.order);
		return Promise.all(
			notes.map(async (note) => {
				const cards = await store.cards.listByNote(note.id);
				const payload =
					note.type === 'occlusion'
						? { ...note.payload, mediaId: fileOf(note.payload.mediaId) }
						: note.type === 'diagram' && note.payload.sourceMediaId
							? { ...note.payload, sourceMediaId: fileOf(note.payload.sourceMediaId) }
							: note.payload;
				// Cards have no order of their own: IDs are made stable (payload first), then sorted.
				const stable = stableIds({
					type: note.type,
					payload,
					check: note.check,
					cards: cards.map(({ variant, path }) => ({ variant, path }))
				}) as { cards: { variant: string }[] };
				stable.cards.sort((a, b) => (a.variant < b.variant ? -1 : 1));
				return stable;
			})
		);
	}

	describe('golden zip: diagrams and an occlusion image with box: lines', () => {
		it('turns the zip into exactly the expected notes and cards', async () => {
			const text = readFileSync(`${GOLDEN}/figures.txt`, 'utf8');
			const expected = JSON.parse(readFileSync(`${GOLDEN}/figures.expected.json`, 'utf8'));
			const zip = zipSync({
				'figures.txt': strToU8(text),
				'pics/Buffer Manager.PNG': strToU8('buffer picture'),
				'pics/query_plan.jpg': strToU8('plan picture'),
				'pics/spare.png': strToU8('unused')
			});
			const opened = service.openZip(zip);
			if (!opened.ok) throw new Error(opened.error);
			const shown = await commit(opened.value.text, opened.value.images);
			expect(shown.errors).toEqual(expected.errors);
			expect(shown.missingImages).toEqual(expected.missingImages);
			expect(shown.unusedImages).toEqual(expected.unusedImages);
			expect(await storedNotes()).toEqual(expected.notes);
		});

		it('refuses a zip with two images that match one name', () => {
			const zip = zipSync({
				'a.txt': strToU8('@deck A'),
				'Slide 12.png': strToU8('one'),
				'slide_12.jpg': strToU8('two')
			});
			const opened = service.openZip(zip);
			expect(opened.ok).toBe(false);
			expect(!opened.ok && opened.error).toContain('Slide 12.png and slide_12.jpg');
		});
	});

	describe('occlusion notes from import', () => {
		/** Decisions log "Phase 6 Q3": no stored occlusion card exists, so no path refresh is needed. */
		it('stores no boxes and no cards, keeping box: labels as unplaced', async () => {
			await commit('@deck A\n@occlusion s.png\nbox: Disk\nbox: Buffer', [image('s.png')]);
			const [note] = await store.notes.list();
			if (!note) throw new Error('No note');
			expect(note.type === 'occlusion' && note.payload).toMatchObject({
				boxes: [],
				unplaced: ['Disk', 'Buffer']
			});
			expect(await store.cards.listByNote(note.id)).toEqual([]);
			expect(await store.cards.list()).toEqual([]);
		});

		it('lists image notes with labels to place in the commit summary (WIP step 9)', async () => {
			const text = '@deck A\n@occlusion s.png\nbox: Disk\nbox: Buffer\n@occlusion t.png';
			const shown = await preview(text, [image('s.png'), image('t.png')]);
			const result = await service.commit(courseId, shown, new Map());
			const notes = await store.notes.list();
			const withLabels = notes.find((n) => n.type === 'occlusion' && n.payload.unplaced);
			expect(result.ok && result.value.toPlace).toEqual([
				{ noteId: withLabels?.id, name: 's.png', count: 2 }
			]);
		});

		it('leaves toPlace out when every image is placed', async () => {
			const shown = await preview('@deck A\n@occlusion s.png', [image('s.png')]);
			const result = await service.commit(courseId, shown, new Map());
			expect(result.ok && 'toPlace' in result.value).toBe(false);
		});

		it('stores no unplaced field when the block has no box: lines', async () => {
			await commit('@deck A\n@occlusion s.png', [image('s.png')]);
			const [note] = await store.notes.list();
			expect(note?.type === 'occlusion' && 'unplaced' in note.payload).toBe(false);
		});

		it('sums up images the reply names but that were not attached', async () => {
			const shown = await preview(
				'@deck A\n@occlusion a.png\n@diagram stack S\nsource: b.png\nX\nY\n@occlusion c.png',
				[image('c.png')]
			);
			expect(shown.missingImages).toEqual(['a.png', 'b.png']);
			expect(shown.noteCounts).toEqual({ occlusion: 1 });
		});
	});

	describe('re-import', () => {
		const OCCLUSION = '@deck A\n@occlusion slide.png\nbox: Disk';

		it('skips an occlusion note on an image the course has, leaving its boxes untouched', async () => {
			await commit(OCCLUSION, [image('slide.png', 'picture')]);
			const [first] = (await store.notes.list()) as Extract<Note, { type: 'occlusion' }>[];
			if (!first) throw new Error('No note');
			const box = { id: randomUUID(), x: 0.1, y: 0.1, w: 0.2, h: 0.1, label: 'Disk' };
			await store.notes.update(first.id, { payload: { ...first.payload, boxes: [box] } });
			// Same bytes under another name: found by its original-file hash.
			const again = await commit('@deck A\n@occlusion Slide (copy).png\nbox: Disk', [
				image('Slide (copy).png', 'picture')
			]);
			expect(again.duplicates).toEqual([{ line: 2, topic: 'A' }]);
			expect(again.images).toEqual([]);
			const notes = await store.notes.list();
			expect(notes).toHaveLength(1);
			expect(notes[0]?.type === 'occlusion' && notes[0].payload.boxes).toEqual([box]);
			expect(await store.media.list()).toHaveLength(1);
		});

		it('keeps an occlusion note on a different image', async () => {
			await commit(OCCLUSION, [image('slide.png', 'picture')]);
			const again = await commit(OCCLUSION, [image('slide.png', 'another picture')]);
			expect(again.duplicates).toEqual([]);
			expect(await store.notes.list()).toHaveLength(2);
		});

		it('skips an identical diagram, and keeps a changed one with the same name, listing it', async () => {
			await commit('@deck A\n@diagram flow Plan\nParser -> Optimizer : tree');
			const same = await commit('@deck A\n@diagram flow plan\nParser -> Optimizer : tree');
			expect(same.duplicates).toEqual([{ line: 2, topic: 'A' }]);
			expect(same.changedDiagrams).toEqual([]);
			const changed = await commit('@deck A\n@diagram flow Plan\nParser -> Executor : tree');
			expect(changed.duplicates).toEqual([]);
			expect(changed.changedDiagrams).toEqual([{ line: 2, topic: 'A', name: 'Plan' }]);
			expect(await store.notes.list()).toHaveLength(2);
		});
	});
});
