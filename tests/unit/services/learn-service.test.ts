import { afterEach, describe, expect, it } from 'vitest';
import type { ReviewEvent } from '#lib/db/schemas/event.ts';
import { LearnService } from '#lib/services/learn-service.ts';
import type { LearnScreen } from '#lib/services/learn-types.ts';
import { ScopeService } from '#lib/services/scope-service.ts';
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
	const scope = new ScopeService({ repos: env.repos, kv: env.kv, logger: env.logger });
	const { topics, sections } = await outline(env);
	const [sec, net] = topics;
	if (!sec || !net) throw new Error('fixture');
	return { env, learn, scope, sec, net, sections };
}

async function finish(stack: StudyStack, start: StudyView): Promise<StudyView> {
	let view = start;
	for (let step = 0; step < 100 && !view.ended; step += 1) {
		if (view.round) {
			view = await stack.study.continueRound(view.sessionId, { afterBreak: false });
			continue;
		}
		if (!view.item) break;
		view = (await stack.study.submit(view.sessionId, rightResponse(view.item.exercise))).view;
	}
	return view;
}

const indexOf = (screens: readonly LearnScreen[], test: (s: LearnScreen) => boolean): number => {
	const i = screens.findIndex(test);
	if (i < 0) throw new Error('fixture: no such screen');
	return i;
};

/** @see SESSION_NOTES §C; PROMPTS §6; Decisions log "Phase 8.6 Q2", "Q3", "Q6"–"Q8", "Q16" */
describe('LearnService', () => {
	it('lists the in-scope topics with their section and card counts', async () => {
		const { env, learn, scope, net } = await setup();
		const topics = await learn.topics(env.courseId);
		expect(topics.map((t) => [t.name, t.sections])).toStrictEqual([
			['Security', 2],
			['Networks', 3]
		]);
		expect(topics.every((t) => t.cards > 0)).toBe(true);
		await scope.set(env.courseId, { topicIds: [net.id], chunkIds: [] });
		expect((await learn.topics(env.courseId)).map((t) => t.name)).toStrictEqual(['Networks']);
		expect(await learn.flow(env.courseId, (await outline(env)).topics[0]?.id ?? net.id)).toBeNull();
	});

	it('a topic flows summary → meet terms → read with tip → questions → … → mixed quiz → summary', async () => {
		const { env, learn, sec } = await setup();
		const flow = await learn.flow(env.courseId, sec.id);
		const screens = flow?.screens ?? [];
		expect(screens.map((s) => s.step)).toStrictEqual([
			'summary',
			'meetTerms',
			'read',
			'questions',
			// Access has no key terms but two non-list facts (Q6).
			'meetTerms',
			'read',
			'questions',
			'mixedQuiz',
			'summary'
		]);
		expect(screens[0]).toMatchObject({ at: 'start', text: 'Security keeps data safe.' });
		expect(screens[1]).toMatchObject({
			terms: [
				{ term: 'Cipher', meaning: 'algorithm that encrypts data', example: null },
				{ term: 'Key', meaning: 'secret that unlocks a cipher', example: null }
			]
		});
		expect(screens[2]).toMatchObject({
			title: 'Crypto',
			tip: 'Lock and key.',
			terms: ['Cipher', 'Key', 'Hash'],
			session: false
		});
		expect(screens.at(-1)).toMatchObject({ step: 'summary', at: 'end' });
	});

	it('a questions step runs an uncredited acquisition session in count rounds', async () => {
		const { env, learn, sec } = await setup();
		const screens = (await learn.flow(env.courseId, sec.id))?.screens ?? [];
		const index = indexOf(screens, (s) => s.step === 'questions');
		const view = await learn.startStep(env.courseId, sec.id, index);
		if (!view) throw new Error('fixture');
		expect(view.mode).toBe('acquisition');
		expect((await env.sessionRepo.get(view.sessionId))?.snapshot.roundBy).toBe('count');
		const end = await finish(env, view);
		expect(end.ended).toBe(true);
		const reviews = (await env.events.list()).filter((e): e is ReviewEvent => e.type === 'review');
		expect(reviews.length).toBeGreaterThan(0);
		expect(reviews.every((e) => e.mode === 'acquisition' && !e.credited)).toBe(true);
	});

	it('meet the terms runs one matching check', async () => {
		const { env, learn, sec } = await setup();
		const screens = (await learn.flow(env.courseId, sec.id))?.screens ?? [];
		const view = await learn.startStep(
			env.courseId,
			sec.id,
			indexOf(screens, (s) => s.step === 'meetTerms')
		);
		expect(view?.progress.total).toBe(1);
		expect(view?.item?.exercise.kind).toBe('matching');
	});

	it('screens that are not sessions throw', async () => {
		const { env, learn, sec } = await setup();
		const screens = (await learn.flow(env.courseId, sec.id))?.screens ?? [];
		const read = indexOf(screens, (s) => s.step === 'read');
		await expect(learn.startStep(env.courseId, sec.id, read)).rejects.toThrow('not a session');
	});

	it('the look-back draws only from sections already answered in Learn', async () => {
		const { env, learn, sec, net, sections } = await setup();
		const netScreens = (await learn.flow(env.courseId, net.id))?.screens ?? [];
		const lookBack = indexOf(netScreens, (s) => s.step === 'lookBack');
		// Nothing read yet: no candidate.
		expect(await learn.startStep(env.courseId, net.id, lookBack)).toBeNull();
		const secScreens = (await learn.flow(env.courseId, sec.id))?.screens ?? [];
		const crypto = sections.get('Crypto');
		const questions = indexOf(
			secScreens,
			(s) => s.step === 'questions' && s.chunkId === crypto?.id
		);
		const started = await learn.startStep(env.courseId, sec.id, questions);
		if (!started) throw new Error('fixture');
		await finish(env, started);
		const view = await learn.startStep(env.courseId, net.id, lookBack);
		const cardId = view?.item?.cardId;
		const card = cardId && (await env.repos.cards.get(cardId));
		const note = card && (await env.repos.notes.get(card.noteId));
		expect(note?.chunkId).toBe(crypto?.id);
	});
});
