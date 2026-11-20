import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ChunkId, CourseId, TopicId } from '#lib/db/schemas/common.ts';
import { generateCards } from '#lib/engine/cardgen.ts';
import { Logger } from '#lib/log/logger.ts';
import { ManualContentService } from '#lib/services/manual-content-service.ts';
import { manualFact } from '#lib/services/manual-fields.ts';
import { setupCardEnv, type CardEnv } from './card-list-fixtures.ts';

/** @see Decisions log "Phase 8.6 Q15" (Manual mode) */
describe('ManualContentService', () => {
	let env: CardEnv;
	let manual: ManualContentService;

	beforeEach(async () => {
		env = await setupCardEnv();
		const logger = new Logger({ sink: { append: async () => {} }, clock: () => 0 });
		manual = new ManualContentService(env.store, logger);
	});

	afterEach(async () => {
		await env.db.delete();
	});

	it('creates an empty course and adds topics and sections in order', async () => {
		const course = await manual.createCourse('  Databases ');
		expect(course).toMatchObject({ name: 'Databases', status: 'active' });
		const first = await manual.addTopic(course.id, 'Normal forms');
		const second = await manual.addTopic(course.id, 'Joins');
		await manual.addSection(first, '1NF', 'Atomic values only.');
		await manual.addSection(first, '2NF', '');
		const outline = await manual.outline(course.id);
		expect(outline?.topics.map((t) => t.name)).toEqual(['Normal forms', 'Joins']);
		expect(outline?.topics[0]?.sections.map((s) => s.title)).toEqual(['1NF', '2NF']);
		expect(outline?.topics[1]?.id).toBe(second);
		const chunks = await env.store.chunks.listByTopic(first);
		expect(chunks.map((c) => [c.order, c.words, c.source])).toEqual([
			[0, 3, 'notes'],
			[1, 0, 'notes']
		]);
		const topic = await env.store.topics.get(first);
		expect(topic).toMatchObject({ order: 0, placement: 'unread', priority: 'normal' });
	});

	it('adds a note with the same cards an import makes, in one write', async () => {
		const course = await manual.createCourse('Networks by hand');
		const topicId = await manual.addTopic(course.id, 'Switching');
		const chunkId = await manual.addSection(topicId, 'Packets', 'Packets travel alone.');
		const fact = manualFact({
			kind: 'definition',
			term: 'Packet switching',
			definition: 'Data split into small packets, routed independently.',
			ticked: new Set([3, 4, 6])
		});
		if (!fact.ok) throw new Error(fact.error);
		const added = await manual.addNote(topicId, chunkId, fact.value);
		expect(added.ok).toBe(true);
		const [note] = await env.store.notes.listByTopic(topicId);
		expect(note).toMatchObject({
			courseId: course.id,
			chunkId,
			order: 0,
			generated: false,
			check: false,
			type: 'fact'
		});
		const cards = await env.store.cards.listByCourse(course.id);
		const byVariant = (a: { variant: string }, b: { variant: string }) =>
			a.variant.localeCompare(b.variant);
		expect(cards.sort(byVariant).map((c) => [c.variant, c.path])).toEqual(
			generateCards(fact.value)
				.result.sort(byVariant)
				.map((spec) => [spec.variant, spec.path])
		);
		const outline = await manual.outline(course.id);
		expect(outline?.topics[0]?.notes).toEqual([
			{ id: note?.id, type: 'fact', title: 'Packet switching', cards: cards.length }
		]);
	});

	it('adds a list fact and a note without a section', async () => {
		const course = await manual.createCourse('C');
		const topicId = await manual.addTopic(course.id, 'T');
		const list = manualFact({ kind: 'list', term: 'Three', items: ['a', 'b', 'c'] });
		if (!list.ok) throw new Error(list.error);
		expect(await manual.addNote(topicId, null, list.value)).toMatchObject({ ok: true });
		const [note] = await env.store.notes.listByTopic(topicId);
		expect(note?.chunkId).toBeUndefined();
		expect(note?.payload).toMatchObject({ list: true, keyWords: ['a', 'b', 'c'] });
	});

	it('refuses a gone topic, a section of another topic, or a note that makes no cards', async () => {
		const course = await manual.createCourse('C');
		const topicId = await manual.addTopic(course.id, 'T');
		const other = await manual.addTopic(course.id, 'U');
		const foreign = await manual.addSection(other, 'S', '');
		const content = { type: 'keyterm', payload: { term: 'x', meaning: 'y' } } as const;
		expect((await manual.addNote(randomUUID() as TopicId, null, content)).ok).toBe(false);
		expect((await manual.addNote(topicId, foreign, content)).ok).toBe(false);
		expect((await manual.addNote(topicId, randomUUID() as ChunkId, content)).ok).toBe(false);
		const empty = { type: 'cloze', payload: { text: 'no blanks' } } as const;
		expect(await manual.addNote(topicId, null, empty)).toMatchObject({ ok: false });
		expect(await env.store.notes.listByTopic(topicId)).toEqual([]);
	});

	it('has no outline for a course that is gone', async () => {
		expect(await manual.outline(randomUUID() as CourseId)).toBeNull();
	});
});
