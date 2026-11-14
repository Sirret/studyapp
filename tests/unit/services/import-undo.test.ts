import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_CARD_CACHES } from '#lib/db/schemas/card.ts';
import type { CardId, CourseId, TopicId } from '#lib/db/schemas/common.ts';
import { setupCardEnv, type CardEnv } from './card-list-fixtures.ts';

const OSI = '@topic osi The OSI Model | from: Lecture I\n';
const ONE = '@section One\n@read\nThe broadcast domain is split.\n@fact\nhub :: repeats bits\n';
const TWO = '@section Two\n@read\nSwitches learn.\n@fact\nswitch :: forwards frames\n';

/**
 * Decisions log "Phase 8.5: undo the latest import, any time"; DATA_MODEL §3.1 `lastImport`.
 */
describe('ImportUndoService', () => {
	let env: CardEnv;

	beforeEach(async () => {
		env = await setupCardEnv();
	});

	afterEach(async () => {
		await env.db.delete();
	});

	async function liveCounts() {
		const topics = await env.store.topics.listByCourse(env.courseId);
		const chunks = (
			await Promise.all(topics.map((topic) => env.store.chunks.listByTopic(topic.id)))
		).flat();
		return {
			topics: topics.length,
			chunks: chunks.length,
			notes: (await env.notes()).length,
			cards: (await env.store.cards.listByCourse(env.courseId)).length
		};
	}

	describe('lastImport', () => {
		it('is null before any import and for a course that is gone', async () => {
			expect(await env.undo.lastImport(env.courseId)).toBeNull();
			expect(await env.undo.lastImport(randomUUID() as CourseId)).toBeNull();
		});

		it('reports the latest import: when, its live notes, and how many of its cards were studied', async () => {
			await env.importText('@deck A\n@fact\nTCP :: reliable\nUDP :: datagrams');
			const tcp = await env.noteWith('TCP');
			const [card] = await env.store.cards.listByNote(tcp.id);
			await env.store.cards.applyReplay({
				[card?.id as CardId]: {
					...EMPTY_CARD_CACHES,
					status: 'learning',
					accuracy: { n: 1, correct: 1 }
				}
			});

			const view = await env.undo.lastImport(env.courseId);
			const course = await env.store.courses.get(env.courseId);
			expect(view).toEqual({ at: course?.lastImport?.at, notes: 2, studiedCards: 1 });
		});

		it('counts only notes that still exist', async () => {
			await env.importText('@deck A\n@fact\nTCP :: reliable\nUDP :: datagrams');
			await env.cardList.deleteNote((await env.noteWith('UDP')).id);
			expect((await env.undo.lastImport(env.courseId))?.notes).toBe(1);
		});
	});

	describe('undo', () => {
		it('fails when there is nothing to undo or the course is gone', async () => {
			expect((await env.undo.undo(env.courseId)).ok).toBe(false);
			expect((await env.undo.undo(randomUUID() as CourseId)).ok).toBe(false);
		});

		it('removes everything a first import created, as tombstones, and clears lastImport', async () => {
			await env.importText('@deck A\n@read\nSome reading.\n@fact\nTCP :: reliable\n@deck B');
			const topicIds = await env.topicIds();
			const noteIds = (await env.notes()).map((note) => note.id);

			const result = await env.undo.undo(env.courseId);

			expect(result).toEqual({ ok: true, value: { topics: 2, notes: 1, cards: 2 } });
			expect(await liveCounts()).toEqual({ topics: 0, chunks: 0, notes: 0, cards: 0 });
			for (const id of topicIds) expect((await env.db.topics.get(id))?.deleted).toBe(true);
			for (const id of noteIds) expect((await env.db.notes.get(id))?.deleted).toBe(true);
			const course = await env.store.courses.get(env.courseId);
			expect(course?.lastImport).toBeUndefined();
			expect(await env.undo.lastImport(env.courseId)).toBeNull();
			expect((await env.undo.undo(env.courseId)).ok).toBe(false);
		});

		it('undoes only the latest import, restoring the topics it changed and the map', async () => {
			await env.importText(`@map Networks\n${OSI}${ONE}@end`);
			const firstCounts = await liveCounts();
			const [osiId] = await env.topicIds();
			const topicBefore = await env.store.topics.get(osiId as TopicId);
			const mapBefore = (await env.store.courses.get(env.courseId))?.map;

			await env.importText(
				`@map Networks\n@topic osi The OSI Model | from: Lecture I, Lecture II\n@summary\nLayers.\n${TWO}@topic tcp TCP\n${ONE}@end`,
				[],
				new Map([['The OSI Model', 'read']])
			);
			expect((await env.store.topics.get(osiId as TopicId))?.placement).toBe('read');

			const result = await env.undo.undo(env.courseId);

			expect(result.ok).toBe(true);
			expect(await liveCounts()).toEqual(firstCounts);
			const restored = await env.store.topics.get(osiId as TopicId);
			expect(restored).toMatchObject({
				placement: topicBefore?.placement,
				priority: topicBefore?.priority,
				key: topicBefore?.key,
				from: topicBefore?.from
			});
			expect(restored?.summary).toBe(topicBefore?.summary);
			expect((await env.store.courses.get(env.courseId))?.map).toEqual(mapBefore);
			expect(await env.noteWith('hub')).toBeDefined();
		});

		it('also removes cards an edit added to a note of the import', async () => {
			await env.importText('@deck A\n@cloze\nThe {{SYN}} then {{ACK}}');
			const note = await env.noteWith('SYN');
			await env.cardList.editNote(note.id, {
				type: 'cloze',
				payload: { text: 'The {{SYN}}, {{SYN-ACK}} then {{ACK}}' }
			});
			const added = (await env.store.cards.listByNote(note.id)).find(
				(card) => card.variant === 'c3'
			);

			await env.undo.undo(env.courseId);

			expect(await env.store.cards.listByCourse(env.courseId)).toEqual([]);
			expect((await env.db.cards.get(added?.id as CardId))?.deleted).toBe(true);
		});

		it('removes the images the import stored', async () => {
			await env.importText('@deck A\n@occlusion s.png', ['s.png']);
			const media = (await env.store.media.list()).filter((item) => item.importId);
			expect(media).toHaveLength(1);

			await env.undo.undo(env.courseId);

			expect(await env.store.media.get(media[0]?.id as string)).toBeUndefined();
		});

		it('keeps review events', async () => {
			await env.importText('@deck A\n@fact\nTCP :: reliable');
			const [card] = await env.store.cards.listByCourse(env.courseId);
			await env.answer(card?.id as CardId);

			await env.undo.undo(env.courseId);

			expect(await env.events.listByCard(card?.id as CardId)).toHaveLength(1);
		});

		it('leaves other courses alone', async () => {
			const other = await env.importer.createCourse('Databases');
			const preview = await env.importer.preview(other.id, '@deck X\n@fact\nkey :: value', []);
			await env.importer.commit(other.id, preview, new Map());
			await env.importText('@deck A\n@fact\nTCP :: reliable');

			await env.undo.undo(env.courseId);

			expect(await env.store.cards.listByCourse(other.id)).toHaveLength(2);
			expect((await env.store.courses.get(other.id))?.lastImport).toBeDefined();
		});
	});
});

/** BUILD_PLAN §10 row 8.5: "re-importing the same text adds no duplicates". */
describe('ImportService: re-import adds no duplicates', () => {
	let env: CardEnv;

	beforeEach(async () => {
		env = await setupCardEnv();
	});

	afterEach(async () => {
		await env.db.delete();
	});

	it('adds no topics, sections, notes or cards when the same text comes again', async () => {
		const text = `@map Networks\n${OSI}${ONE}${TWO}@end`;
		await env.importText(text);
		const first = await env.store.cards.listByCourse(env.courseId);
		const notesFirst = await env.notes();

		await env.importText(text);

		expect((await env.notes()).map((note) => note.id)).toEqual(notesFirst.map((note) => note.id));
		expect((await env.store.cards.listByCourse(env.courseId)).length).toBe(first.length);
		const [topicId] = await env.topicIds();
		expect(await env.topicIds()).toHaveLength(1);
		expect(await env.store.chunks.listByTopic(topicId as TopicId)).toHaveLength(2);
	});

	it('matches a note in another topic, and an earlier copy in the same paste', async () => {
		await env.importText('@deck A\n@fact\nTCP :: reliable');
		await env.importText('@deck B\n@fact\ntcp :: Reliable.\nUDP :: datagrams\nUDP :: datagrams');
		const prompts = (await env.notes()).map((note) => JSON.stringify(note.payload));
		expect(prompts).toHaveLength(2);
	});

	it('attaches new notes in a reused section to the existing section', async () => {
		await env.importText(`${OSI}${ONE}@end`);
		await env.importText(
			`${OSI}@section One\n@read\nThe broadcast domain is split.\n@fact\nbridge :: joins segments\n@end`
		);
		const [topicId] = await env.topicIds();
		const chunks = await env.store.chunks.listByTopic(topicId as TopicId);
		expect(chunks).toHaveLength(1);
		expect((await env.noteWith('bridge')).chunkId).toBe(chunks[0]?.id);
	});

	it('stamps the import on what it created and records lastImport', async () => {
		await env.importText(`${OSI}${ONE}@end`);
		const course = await env.store.courses.get(env.courseId);
		const importId = course?.lastImport?.importId;
		expect(importId).toBeDefined();
		const [topicId] = await env.topicIds();
		expect((await env.store.topics.get(topicId as TopicId))?.importId).toBe(importId);
		const [chunk] = await env.store.chunks.listByTopic(topicId as TopicId);
		expect(chunk?.importId).toBe(importId);
		expect((await env.noteWith('hub')).importId).toBe(importId);
		const cards = await env.store.cards.listByCourse(env.courseId);
		expect(cards.every((card) => card.importId === importId)).toBe(true);
	});
});
