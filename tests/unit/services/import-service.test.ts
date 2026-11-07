import 'fake-indexeddb/auto';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	CourseColorSchema,
	type CourseId,
	type Placement,
	type TopicId
} from '#lib/db/schemas/common.ts';
import { EMPTY_CARD_CACHES } from '#lib/db/schemas/card.ts';
import type { Course } from '#lib/db/schemas/course.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import { ContentStore } from '#lib/db/repos/content-store.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { createDb, type SnowpackDb } from '#lib/db/schema.ts';
import { DEFAULT_EXAM_FORMAT } from '#lib/config/defaults.ts';
import { CHATBOT_PROMPT } from '#lib/import/prompt.ts';
import { Logger } from '#lib/log/logger.ts';
import {
	ImportService,
	type ImageEncoder,
	type ImportPreview,
	type PreparedImage
} from '#lib/services/import-service.ts';

const NOW = 5_000;
const GOLDEN = 'tests/golden/import';

const encoder: ImageEncoder = {
	encode: async (source) => ({ ok: true, value: { blob: source, width: 40, height: 20 } })
};

/** Rewrites each UUID in a value to `id1`, `id2`… by first appearance, so output can be compared. */
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

/** Cards have no order of their own: they are found by variant, so compare them that way. */
function sortCards(topics: unknown): unknown {
	const byVariant = (a: { variant: string }, b: { variant: string }) =>
		a.variant < b.variant ? -1 : 1;
	return (topics as { notes: { cards: { variant: string }[] }[] }[]).map((topic) => ({
		...topic,
		notes: topic.notes.map((note) => ({ ...note, cards: [...note.cards].sort(byVariant) }))
	}));
}

describe('ImportService', () => {
	let db: SnowpackDb;
	let store: ContentStore;
	let service: ImportService;
	let course: Course;
	let courseId: CourseId;
	let dbCount = 0;

	beforeEach(async () => {
		dbCount += 1;
		db = createDb(`import-test-${dbCount}`);
		const device = new DeviceRepo(db, randomUUID);
		store = new ContentStore(db, {
			clock: () => NOW,
			newId: randomUUID,
			getDeviceId: () => device.getDeviceId()
		});
		const logger = new Logger({ sink: { append: async () => {} }, clock: () => NOW });
		service = new ImportService(store, encoder, randomUUID, logger);
		course = await service.createCourse('Networks');
		courseId = course.id;
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		await db.delete();
	});

	async function prepare(...names: string[]): Promise<PreparedImage[]> {
		const sources = names.map((name) => ({ name, blob: new Blob([name], { type: 'image/png' }) }));
		const { images, errors } = await service.prepareImages(sources);
		expect(errors).toEqual([]);
		return images;
	}

	async function commit(
		text: string,
		images: PreparedImage[] = [],
		placements: ReadonlyMap<string, Placement> = new Map()
	): Promise<ImportPreview> {
		const preview = await service.preview(courseId, text, images);
		const result = await service.commit(courseId, preview, placements);
		if (!result.ok) throw new Error(result.error);
		return preview;
	}

	/** Reads back what a commit stored, in the shape of the golden files. */
	async function storedTree(): Promise<unknown[]> {
		const topics = await store.topics.listByCourse(courseId);
		const media = await store.media.list();
		return Promise.all(
			topics.map(async (topic) => {
				const chunks = await store.chunks.listByTopic(topic.id);
				const notes = await store.notes.listByTopic(topic.id);
				return {
					name: topic.name,
					order: topic.order,
					placement: topic.placement,
					priority: topic.priority,
					chunks: chunks.map(({ order, text, words, source }) => ({ order, text, words, source })),
					notes: await Promise.all(
						notes.map(async (note) => {
							const cards = await store.cards.listByNote(note.id);
							return stableIds({
								type: note.type,
								...(note.chunkId
									? { chunk: chunks.findIndex((chunk) => chunk.id === note.chunkId) }
									: {}),
								payload: withMediaName(note, media),
								priority: note.priority,
								tags: note.tags,
								generated: note.generated,
								check: note.check,
								accept: note.accept,
								cards: cards.map(({ variant, path }) => ({ variant, path }))
							});
						})
					)
				};
			})
		);
	}

	function withMediaName(note: Note, media: { id: string; fileName?: string }[]): unknown {
		if (note.type !== 'occlusion') return note.payload;
		const file = media.find((item) => item.id === note.payload.mediaId)?.fileName;
		return { ...note.payload, mediaId: `media:${file}` };
	}

	describe('golden files: exact text to exact notes and cards', () => {
		it.each(['full', 'malformed'])('%s', async (name) => {
			const text = readFileSync(`${GOLDEN}/${name}.txt`, 'utf8');
			const expected = JSON.parse(readFileSync(`${GOLDEN}/${name}.expected.json`, 'utf8'));
			const preview = await commit(text, await prepare('slide12.png'));
			expect(preview.errors).toEqual(expected.errors);
			expect(preview.plan.coverage).toEqual(expected.coverage);
			expect(sortCards(await storedTree())).toEqual(sortCards(expected.topics));
		});
	});

	describe('the example in the concept', () => {
		it('imports with no errors', async () => {
			const concept = readFileSync('docs/CONCEPT.md', 'utf8');
			const start = concept.indexOf('@deck Networking');
			const text = concept.slice(start, concept.indexOf('```', start));
			const preview = await service.preview(courseId, text, await prepare('slide12.png'));
			expect(preview.errors).toEqual([]);
			expect(preview.noteCounts).toEqual({
				keyterm: 1,
				fact: 2,
				cloze: 1,
				sequence: 1,
				compare: 1,
				scenario: 1,
				diagram: 2,
				occlusion: 1,
				example: 1
			});
		});
	});

	describe('note order', () => {
		it('keeps file order within a topic, continuing across imports', async () => {
			const terms = ['z', 'y', 'x', 'w', 'v', 'u'];
			const lines = (from: number, to: number) =>
				terms.slice(from, to).map((term) => `${term} :: d`);
			await commit(['@deck A', '@fact', ...lines(0, 3)].join('\n'));
			await commit(['@deck A', '@fact', ...lines(3, 6)].join('\n'));
			const [topic] = await store.topics.listByCourse(courseId);
			const notes = await store.notes.listByTopic(topic?.id as TopicId);
			expect(notes.map((note) => note.order)).toEqual([0, 1, 2, 3, 4, 5]);
			expect(notes.map((note) => note.type === 'fact' && note.payload.term)).toEqual(terms);
		});
	});

	describe('createCourse', () => {
		it('uses the default exam format and is active', () => {
			expect(course).toMatchObject({
				name: 'Networks',
				status: 'active',
				examFormat: DEFAULT_EXAM_FORMAT
			});
		});

		it('assigns colours in order, and wraps around', async () => {
			const colors = CourseColorSchema.options;
			expect(course.color).toBe(colors[0]);
			const later: string[] = [];
			for (const name of colors) later.push((await service.createCourse(name)).color);
			expect(later).toEqual([...colors.slice(1), colors[0]]);
		});

		it('lists the courses it created', async () => {
			expect((await service.listCourses()).map((item) => item.name)).toEqual(['Networks']);
		});
	});

	describe('preview', () => {
		it('writes nothing', async () => {
			await service.preview(courseId, '@deck A\n@fact\na :: 1', []);
			expect(await store.topics.list()).toEqual([]);
			expect(await store.notes.list()).toEqual([]);
		});

		it('counts per topic, per note type and overall', async () => {
			const preview = await service.preview(
				courseId,
				'@deck A\n@read\n[GENERATED] x\n@fact\na :: 1\nb :: 2\n@cloze\n{{c}}\n@deck B\n@scenario\nd :: e',
				[]
			);
			expect(preview.topics).toEqual([
				{ name: 'A', chunks: 1, notes: 3, cards: 5 },
				{ name: 'B', chunks: 0, notes: 1, cards: 1 }
			]);
			expect(preview.noteCounts).toEqual({ fact: 2, cloze: 1, scenario: 1 });
			expect(preview.cardCount).toBe(6);
			expect(preview.chunkCount).toBe(1);
			expect(preview.generatedChunkCount).toBe(1);
		});

		it('lists [CHECK] items from notes and chunks with their line, without the marker', async () => {
			const preview = await service.preview(
				courseId,
				'@deck A\n@fact\na :: 1 [CHECK]\nb :: 2\n@read\nunclear text [CHECK]\n@sequence S\none\ntwo [CHECK]',
				[]
			);
			expect(preview.checked).toEqual([
				{ line: 3, text: 'a :: 1' },
				{ line: 5, text: 'unclear text' },
				{ line: 7, text: '@sequence S' }
			]);
		});

		it('merges parse and build errors in line order', async () => {
			const preview = await service.preview(courseId, '@fact\na :: 1\n@deck A\nstray', []);
			expect(preview.errors.map((error) => error.line)).toEqual([1, 4]);
		});

		it('marks topics that already exist in the course', async () => {
			await commit('@deck A');
			const preview = await service.preview(courseId, '@deck A\n@deck B', []);
			expect(preview.topics.map((topic) => topic.existing?.name)).toEqual(['A', undefined]);
		});

		it('does not match a topic that was deleted', async () => {
			await commit('@deck A');
			const [topic] = await store.topics.listByCourse(courseId);
			await store.topics.softDelete(topic?.id as TopicId);
			const preview = await service.preview(courseId, '@deck A', []);
			expect(preview.topics[0]?.existing).toBeUndefined();
		});

		it('lists attached images that no block names', async () => {
			const images = await prepare('used.png', 'spare.png');
			const preview = await service.preview(courseId, '@deck A\n@occlusion USED.png', images);
			expect(preview.errors).toEqual([]);
			expect(preview.unusedImages).toEqual(['spare.png']);
		});
	});

	describe('commit', () => {
		it('sets repository fields and empty scheduling caches on what it writes', async () => {
			await commit('@deck A\n@fact\na :: 1');
			const [note] = await store.notes.list();
			const [card] = await store.cards.list();
			expect(note).toMatchObject({ courseId, createdAt: NOW, updatedAt: NOW });
			expect(card).toMatchObject({
				...EMPTY_CARD_CACHES,
				noteId: note?.id,
				courseId,
				suspended: false
			});
		});

		it('reports what it wrote', async () => {
			const preview = await service.preview(
				courseId,
				'@deck A\n@read\nx\n@fact\na :: 1\n@occlusion s.png',
				await prepare('s.png')
			);
			expect(await service.commit(courseId, preview, new Map())).toEqual({
				ok: true,
				value: { topics: 1, chunks: 1, notes: 2, cards: 2, images: 1 }
			});
		});

		it('applies the placement tapped per topic, defaulting to unread', async () => {
			await commit('@deck A\n@deck B', [], new Map([['A', 'read']]));
			const topics = await store.topics.listByCourse(courseId);
			expect(topics.map((topic) => topic.placement)).toEqual(['read', 'unread']);
		});

		it('adds to an existing topic, continuing its chunk order', async () => {
			await commit('@deck A\n@read\none');
			await commit('@deck A\n@read\ntwo\n@fact\na :: 1');
			const topics = await store.topics.listByCourse(courseId);
			expect(topics).toHaveLength(1);
			const chunks = await store.chunks.listByTopic(topics[0]?.id as TopicId);
			expect(chunks.map((chunk) => [chunk.order, chunk.text])).toEqual([
				[0, 'one'],
				[1, 'two']
			]);
			const notes = await store.notes.listByTopic(topics[0]?.id as TopicId);
			expect(notes[0]?.chunkId).toBe(chunks[1]?.id);
		});

		it("places new topics after the course's existing ones", async () => {
			await commit('@deck A\n@deck B');
			await commit('@deck C');
			const topics = await store.topics.listByCourse(courseId);
			expect(topics.map((topic) => [topic.name, topic.order])).toEqual([
				['A', 0],
				['B', 1],
				['C', 2]
			]);
		});

		it("changes an existing topic's placement only when one was tapped", async () => {
			await commit('@deck A', [], new Map([['A', 'read']]));
			await commit('@deck A');
			expect((await store.topics.listByCourse(courseId))[0]?.placement).toBe('read');
			await commit('@deck A', [], new Map([['A', 'unread']]));
			expect((await store.topics.listByCourse(courseId))[0]?.placement).toBe('unread');
		});

		it('raises an existing topic to high priority but never lowers it', async () => {
			await commit('@deck A');
			await commit('@deck A\n@priority high');
			expect((await store.topics.listByCourse(courseId))[0]?.priority).toBe('high');
			await commit('@deck A\n@priority normal');
			expect((await store.topics.listByCourse(courseId))[0]?.priority).toBe('high');
		});

		it('keeps topics separate per course', async () => {
			await commit('@deck A');
			const other = await service.createCourse('Other');
			const preview = await service.preview(other.id, '@deck A', []);
			expect(preview.topics[0]?.existing).toBeUndefined();
			await service.commit(other.id, preview, new Map());
			expect(await store.topics.listByCourse(other.id)).toHaveLength(1);
		});

		it('stores [CHECK] on a chunk', async () => {
			await commit('@deck A\n@read\nx [CHECK]');
			expect((await store.chunks.list())[0]?.check).toBe(true);
		});

		it('fails without writing when the course does not exist', async () => {
			const preview = await service.preview(courseId, '@deck A', []);
			const missing = randomUUID() as CourseId;
			expect(await service.commit(missing, preview, new Map())).toEqual({
				ok: false,
				error: 'That course no longer exists.'
			});
			expect(await store.topics.list()).toEqual([]);
		});

		it('writes nothing at all when one write fails', async () => {
			const preview = await service.preview(
				courseId,
				'@deck A\n@read\nx\n@fact\na :: 1\n@occlusion s.png\n@deck B\n@fact\nb :: 2',
				await prepare('s.png')
			);
			// Cards are written last, so everything else has been written by the time this fails.
			vi.spyOn(db.cards, 'bulkAdd').mockRejectedValue(new Error('disk full'));
			const result = await service.commit(courseId, preview, new Map());
			expect(result).toEqual({ ok: false, error: 'The import could not be saved: disk full' });
			expect(await store.topics.list()).toEqual([]);
			expect(await store.chunks.list()).toEqual([]);
			expect(await store.notes.list()).toEqual([]);
			expect(await store.media.list()).toEqual([]);
		});
	});

	describe('images', () => {
		it('hashes the encoded bytes with SHA-256 and keeps the encoded size', async () => {
			const [image] = await prepare('a.png');
			expect(image).toMatchObject({
				fileName: 'a.png',
				hash: createHash('sha256').update('a.png').digest('hex'),
				width: 40,
				height: 20
			});
		});

		it('gives identical bytes the same hash and different bytes different hashes', async () => {
			const [a, same, other] = await service
				.prepareImages([
					{ name: 'a.png', blob: new Blob(['x']) },
					{ name: 'b.png', blob: new Blob(['x']) },
					{ name: 'c.png', blob: new Blob(['y']) }
				])
				.then((output) => output.images);
			expect(same?.hash).toBe(a?.hash);
			expect(other?.hash).not.toBe(a?.hash);
		});

		it('reports an image it cannot encode by name, and keeps the others', async () => {
			const failing = new ImportService(
				store,
				{
					encode: async (source) =>
						source.size === 0
							? { ok: false, error: 'not an image' }
							: { ok: true, value: { blob: source, width: 1, height: 1 } }
				},
				randomUUID,
				new Logger({ sink: { append: async () => {} }, clock: () => NOW })
			);
			const output = await failing.prepareImages([
				{ name: 'bad.png', blob: new Blob([]) },
				{ name: 'good.png', blob: new Blob(['x']) }
			]);
			expect(output.images.map((image) => image.fileName)).toEqual(['good.png']);
			expect(output.errors).toEqual(['bad.png: not an image']);
		});

		it('stores a referenced image as WebP with its size, and links the note to it', async () => {
			await commit('@deck A\n@occlusion s.png', await prepare('s.png'));
			const [media] = await store.media.list();
			expect(media).toMatchObject({
				mime: 'image/webp',
				fileName: 's.png',
				width: 40,
				height: 20,
				bytes: 's.png'.length
			});
			const [note] = await store.notes.list();
			expect(note?.type === 'occlusion' && note.payload.mediaId).toBe(media?.id);
		});

		it('links a diagram to its source image', async () => {
			await commit('@deck A\n@diagram stack S\nsource: s.png\nA\nB', await prepare('s.png'));
			const [media] = await store.media.list();
			const [note] = await store.notes.list();
			expect(note?.type === 'diagram' && note.payload.sourceMediaId).toBe(media?.id);
		});

		it('does not store attached images that no block names', async () => {
			await commit('@deck A', await prepare('spare.png'));
			expect(await store.media.list()).toEqual([]);
		});

		it('reuses a stored image with the same hash, even under another name', async () => {
			await commit('@deck A\n@occlusion s.png', await prepare('s.png'));
			const twin = await service.prepareImages([
				{ name: 'copy.png', blob: new Blob(['s.png'], { type: 'image/png' }) }
			]);
			await commit('@deck A\n@occlusion copy.png', twin.images);
			const media = await store.media.list();
			expect(media).toHaveLength(1);
			const notes = await store.notes.list();
			expect(notes.map((note) => note.type === 'occlusion' && note.payload.mediaId)).toEqual([
				media[0]?.id,
				media[0]?.id
			]);
		});

		it('counts only new images in its summary', async () => {
			await commit('@deck A\n@occlusion s.png', await prepare('s.png'));
			const preview = await service.preview(
				courseId,
				'@deck A\n@occlusion s.png',
				await prepare('s.png')
			);
			const result = await service.commit(courseId, preview, new Map());
			expect(result.ok && result.value.images).toBe(0);
		});
	});

	describe('openZip', () => {
		it('returns the text and images of a zip', () => {
			const result = service.openZip(
				zipSync({ 'a.txt': strToU8('@deck A'), 'b.png': new Uint8Array([1]) })
			);
			expect(result.ok && result.value.text).toBe('@deck A');
		});
	});

	describe('the chatbot prompt', () => {
		it('matches the spec word for word', () => {
			const plan = readFileSync('docs/BUILD_PLAN.md', 'utf8').replaceAll('\r\n', '\n');
			const start = plan.indexOf('You convert my lecture notes');
			const end = plan.indexOf('[paste]', start) + '[paste]'.length;
			expect(CHATBOT_PROMPT).toBe(plan.slice(start, end));
		});
	});
});
