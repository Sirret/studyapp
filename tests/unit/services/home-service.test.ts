import { afterEach, describe, expect, it } from 'vitest';
import type { SessionId } from '#lib/db/schemas/common.ts';
import { HomeService, leftOffMode } from '#lib/services/home-service.ts';
import { LearnService } from '#lib/services/learn-service.ts';
import type { StudyView } from '#lib/services/study-types.ts';
import { LEARN_COURSE_TEXT, outline } from './learn-fixtures.ts';
import { rightResponse, studyStack, type StudyStack } from './study-fixtures.ts';

let env: StudyStack | undefined;
afterEach(async () => {
	await env?.db.delete();
	env = undefined;
});

async function setup() {
	env = await studyStack(LEARN_COURSE_TEXT);
	const learn = new LearnService({
		repos: env.repos,
		events: env.events,
		kv: env.kv,
		study: env.study,
		logger: env.logger
	});
	const home = new HomeService({ repos: env.repos, events: env.events, learn });
	const { topics } = await outline(env);
	const [sec, net] = topics;
	if (!sec || !net) throw new Error('fixture');
	return { env, learn, home, sec, net };
}

async function finish(stack: StudyStack, start: StudyView): Promise<void> {
	let view = start;
	for (let step = 0; step < 100 && !view.ended; step += 1) {
		if (view.round) {
			view = await stack.study.continueRound(view.sessionId, { afterBreak: false });
			continue;
		}
		if (!view.item) break;
		view = (await stack.study.submit(view.sessionId, rightResponse(view.item.exercise))).view;
	}
}

/** @see SESSION_NOTES §K (returning home); DESIGN §12 rows "Welcome, Home, Today", "Courses" */
describe('HomeService', () => {
	it('no answers yet: nothing to continue', async () => {
		const { home } = await setup();
		expect(await home.leftOff()).toBeNull();
	});

	it("after a Learn step, Continue points at that topic in Learn with what's read", async () => {
		const { env, learn, home, sec } = await setup();
		const screens = (await learn.flow(env.courseId, sec.id))?.screens ?? [];
		const index = screens.findIndex((s) => s.step === 'questions');
		const view = await learn.startStep(env.courseId, sec.id, index);
		if (!view) throw new Error('fixture');
		await finish(env, view);
		expect(await home.leftOff()).toMatchObject({
			courseId: env.courseId,
			courseName: 'Networking',
			mode: 'learn',
			topicId: sec.id,
			topicName: 'Security',
			sections: 2,
			read: 1
		});
	});

	it('the latest answer wins: a later Practice answer in another topic', async () => {
		const { env, home, net } = await setup();
		const cards = await env.repos.cards.listByCourse(env.courseId);
		const notes = await env.repos.notes.listByTopic(net.id);
		const card = cards.find((c) => c.noteId === notes[0]?.id);
		if (!card) throw new Error('fixture');
		await env.events.append({
			type: 'review',
			cardId: card.id,
			sessionId: crypto.randomUUID() as SessionId,
			mode: 'practice',
			kind: 'mc',
			weight: 'recognition',
			firstAttempt: true,
			correct: true,
			responseMs: 1000,
			credited: false
		});
		expect(await home.leftOff()).toMatchObject({ mode: 'practice', topicName: 'Networks' });
	});

	it('answers in a deleted course are skipped', async () => {
		const { env, learn, home, sec } = await setup();
		const screens = (await learn.flow(env.courseId, sec.id))?.screens ?? [];
		const view = await learn.startStep(
			env.courseId,
			sec.id,
			screens.findIndex((s) => s.step === 'questions')
		);
		if (!view) throw new Error('fixture');
		await finish(env, view);
		await env.repos.courses.softDelete(env.courseId);
		expect(await home.leftOff()).toBeNull();
		expect(await home.shelf()).toStrictEqual([]);
	});

	it('the shelf lists each course with its topics, sections and sections read', async () => {
		const { env, home } = await setup();
		expect(await home.shelf()).toMatchObject([
			{ id: env.courseId, name: 'Networking', topics: 2, sections: 5, read: 0 }
		]);
	});

	it('modes map to where Continue goes', () => {
		expect(leftOffMode('acquisition')).toBe('learn');
		expect(leftOffMode('practice')).toBe('practice');
		expect(['cram', 'longterm', 'onenight'].map((m) => leftOffMode(m as never))).toStrictEqual([
			'exam',
			'exam',
			'exam'
		]);
	});
});
