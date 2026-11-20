import { afterEach, describe, expect, it } from 'vitest';
import type { ChunkId, TopicId } from '#lib/db/schemas/common.ts';
import { loadCourseData } from '#lib/services/planner-inputs.ts';
import { ScopeService } from '#lib/services/scope-service.ts';
import { LEARN_COURSE_TEXT, outline } from './learn-fixtures.ts';
import { studyStack, type StudyStack } from './study-fixtures.ts';

let env: StudyStack | undefined;
afterEach(async () => {
	await env?.db.delete();
	env = undefined;
});

async function setup() {
	env = await studyStack(LEARN_COURSE_TEXT);
	const scope = new ScopeService({ repos: env.repos, kv: env.kv, logger: env.logger });
	const { topics, sections } = await outline(env);
	const [sec, net] = topics;
	const section = (title: string): ChunkId => {
		const found = sections.get(title);
		if (!found) throw new Error(`fixture: ${title}`);
		return found.id;
	};
	if (!sec || !net) throw new Error('fixture');
	return { env, scope, sec, net, section };
}

/** @see SESSION_NOTES J; Decisions log "Phase 8.6 Q12" */
describe('ScopeService', () => {
	it('defaults to the whole course with every topic and section checked', async () => {
		const { env, scope } = await setup();
		const view = await scope.view(env.courseId);
		expect(view).toMatchObject({ whole: true, topics: 2, of: 2 });
		expect(view.tree.map((t) => t.name)).toStrictEqual(['Security', 'Networks']);
		expect(view.tree.every((t) => t.checked && t.sections.every((s) => s.checked))).toBe(true);
		expect(view.tree[1]?.sections.map((s) => s.title)).toStrictEqual([
			'Layers',
			'Addresses',
			'Ports'
		]);
	});

	it('a listed topic checks it and its sections, and counts 1 of 2', async () => {
		const { env, scope, sec } = await setup();
		await scope.set(env.courseId, { topicIds: [sec.id], chunkIds: [] });
		const view = await scope.view(env.courseId);
		expect(view).toMatchObject({ whole: false, topics: 1, of: 2 });
		expect(view.tree[0]?.checked).toBe(true);
		expect(view.tree[0]?.sections.every((s) => s.checked)).toBe(true);
		expect(view.tree[1]?.checked).toBe(false);
		expect(view.tree[1]?.sections.some((s) => s.checked)).toBe(false);
	});

	it('drops sections covered by a listed topic and ids from other courses', async () => {
		const { env, scope, sec, section } = await setup();
		await scope.set(env.courseId, {
			topicIds: [sec.id, 'other-topic' as TopicId],
			chunkIds: [section('Crypto'), section('Ports'), 'other-chunk' as ChunkId]
		});
		expect(await scope.get(env.courseId)).toStrictEqual({
			topicIds: [sec.id],
			chunkIds: [section('Ports')]
		});
		const view = await scope.view(env.courseId);
		expect(view.topics).toBe(2);
		expect(view.tree[1]?.sections.map((s) => s.checked)).toStrictEqual([false, false, true]);
	});

	it('clear and an empty selection both go back to "Study all"', async () => {
		const { env, scope, sec } = await setup();
		await scope.set(env.courseId, { topicIds: [sec.id], chunkIds: [] });
		await scope.clear(env.courseId);
		expect(await scope.get(env.courseId)).toBeUndefined();
		await scope.set(env.courseId, { topicIds: [sec.id], chunkIds: [] });
		await scope.set(env.courseId, { topicIds: [], chunkIds: [] });
		expect(await env.kv.get('studyScope')).toStrictEqual({});
	});

	it('Exam prep data holds only in-scope notes, cards, sections and topics', async () => {
		const { env, scope, net, section } = await setup();
		await scope.set(env.courseId, { topicIds: [], chunkIds: [section('Layers')] });
		const stored = await scope.get(env.courseId);
		const events = await env.events.list();
		const all = await loadCourseData(env.repos, env.courseId, events);
		const scoped = await loadCourseData(env.repos, env.courseId, events, stored);
		const layerNotes = [...all.material.notes.values()].filter(
			(n) => n.chunkId === section('Layers')
		);
		expect([...scoped.material.notes.keys()].sort()).toStrictEqual(
			layerNotes.map((n) => n.id).sort()
		);
		expect(scoped.material.cards.length).toBeGreaterThan(0);
		expect(scoped.material.cards.every((c) => scoped.material.notes.has(c.noteId))).toBe(true);
		expect(scoped.chunks.map((c) => c.id)).toStrictEqual([section('Layers')]);
		expect(scoped.topics.map((t) => t.id)).toStrictEqual([net.id]);
		expect(await loadCourseData(env.repos, env.courseId, events, undefined)).toStrictEqual(all);
	});
});
