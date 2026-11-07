import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { PRACTICE_SESSION_CARDS } from '#lib/config/defaults.ts';
import { CardRepo, CourseRepo, NoteRepo, TopicRepo } from '#lib/db/repos/content-repos.ts';
import { ContentStore } from '#lib/db/repos/content-store.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { EventRepo } from '#lib/db/repos/event-repo.ts';
import { KvRepo } from '#lib/db/repos/kv-repo.ts';
import { SessionRepo } from '#lib/db/repos/session-repo.ts';
import { createDb } from '#lib/db/schema.ts';
import type { CourseId, ExerciseKind } from '#lib/db/schemas/common.ts';
import { Logger } from '#lib/log/logger.ts';
import { SAMPLE_COURSE_TEXT, SAMPLE_KINDS, sampleKindPlan } from '#lib/services/dev-sample.ts';
import { ImportService, type ImageEncoder } from '#lib/services/import-service.ts';
import { kvReplayConfig, ReplayService } from '#lib/services/replay-service.ts';
import { SessionService } from '#lib/services/session-service.ts';
import { loadCourse, practiceCards } from '#lib/services/study-course.ts';
import { StudyService } from '#lib/services/study-service.ts';
import type { ExerciseResponse, ExerciseSpec, StudyView } from '#lib/services/study-types.ts';

let db = createDb(`study-${randomUUID()}`);
const now = Date.UTC(2026, 2, 10, 12);
const encoder: ImageEncoder = { encode: async () => ({ ok: false, error: 'no images' }) };

afterEach(async () => {
	await db.delete();
});

async function setup() {
	db = createDb(`study-${randomUUID()}`);
	let tick = now;
	const clock = () => (tick += 1000);
	const device = new DeviceRepo(db, randomUUID);
	const context = { clock, newId: randomUUID, getDeviceId: () => device.getDeviceId() };
	const repos = {
		courses: new CourseRepo(db, context),
		topics: new TopicRepo(db, context),
		notes: new NoteRepo(db, context),
		cards: new CardRepo(db, context)
	};
	const events = new EventRepo(db, { clock, newId: randomUUID, device });
	const kv = new KvRepo(db);
	const logger = new Logger({ sink: { append: async () => {} }, clock });
	const replayConfig = kvReplayConfig(kv, () => 0);
	const replay = new ReplayService(events, repos.cards, logger, replayConfig);
	const sessions = new SessionService({
		sessions: new SessionRepo(db),
		events,
		cards: repos.cards,
		replay,
		replayConfig,
		clock,
		newId: randomUUID,
		logger
	});
	const study = new StudyService({ sessions, repos, events, kv, replay, clock, logger });
	const importer = new ImportService(new ContentStore(db, context), encoder, randomUUID, logger);
	const course = await importer.createCourse('Networking');
	const preview = await importer.preview(course.id, SAMPLE_COURSE_TEXT, []);
	expect(preview.errors).toStrictEqual([]);
	const committed = await importer.commit(course.id, preview, new Map());
	expect(committed.ok).toBe(true);
	return { study, repos, events, courseId: course.id as CourseId };
}

/** The right response to a spec, as a student who knows everything gives it. */
function rightResponse(spec: ExerciseSpec): ExerciseResponse {
	switch (spec.shape) {
		case 'type':
			return { shape: 'type', typed: spec.answer };
		case 'choose':
			return { shape: 'choose', index: spec.correctIndex };
		case 'chooseMany':
			return { shape: 'chooseMany', indexes: spec.correct };
		case 'order':
			return { shape: 'order', order: spec.correctOrder };
		case 'pair':
			return { shape: 'pair', matches: spec.pairs };
		case 'sort':
			return { shape: 'sort', placed: spec.bucketOf };
		case 'selfRate':
			return { shape: 'selfRate', checked: spec.checklist.map((_c, i) => i), rating: 'good' };
		case 'study':
			return { shape: 'study' };
	}
}

async function harness(env: Awaited<ReturnType<typeof setup>>) {
	const material = await loadCourse(env.repos, env.courseId);
	const cards = material.cards.map((card) => {
		const note = material.notes.get(card.noteId);
		const key =
			note?.type === 'keyterm' || note?.type === 'fact'
				? note.payload.term
				: note?.type === 'sequence' || note?.type === 'example'
					? note.payload.name
					: note?.type === 'compare'
						? (note.payload.items[0] ?? '')
						: note?.type === 'scenario'
							? note.payload.situation
							: 'router';
		return { id: card.id, variant: card.variant, noteType: note?.type ?? 'fact', noteKey: key };
	});
	return sampleKindPlan(cards);
}

describe('StudyService (Decisions log, Phase 5)', () => {
	it('lists the active courses', async () => {
		const env = await setup();
		expect(await env.study.listCourses()).toMatchObject([{ id: env.courseId, name: 'Networking' }]);
	});

	it('practice sessions take live, non-diagram cards in course order, at most the cap', async () => {
		const env = await setup();
		const material = await loadCourse(env.repos, env.courseId);
		const picked = practiceCards(material);
		expect(picked.length).toBe(Math.min(PRACTICE_SESSION_CARDS, material.cards.length));
		expect(picked.map((card) => card.id)).toStrictEqual(
			material.cards.slice(0, picked.length).map((card) => card.id)
		);
	});

	it('plays the harness session to the end, showing every non-diagram kind', async () => {
		const env = await setup();
		let view: StudyView = await env.study.startCourse(env.courseId, await harness(env));
		const seen = new Set<ExerciseKind>();
		for (let step = 0; step < 400 && !view.ended; step += 1) {
			if (view.round) {
				view = await env.study.continueRound(view.sessionId, { afterBreak: false });
				continue;
			}
			const item = view.item;
			if (!item) break;
			seen.add(item.exercise.kind);
			const answer = await env.study.submit(view.sessionId, rightResponse(item.exercise));
			expect(answer.verdict.correct, `${item.exercise.kind} on ${item.cardId}`).toBe(true);
			view = answer.view;
		}
		expect(view.ended).toBe(true);
		expect(view.progress.done).toBe(view.progress.total);
		expect([...SAMPLE_KINDS].filter((kind) => !seen.has(kind))).toStrictEqual([]);
		const types = new Set((await env.events.list()).map((event) => event.type));
		expect([...types].sort()).toStrictEqual(['pretest', 'review', 'selfRated']);
	});

	it('after a wrong typed answer, shows the redo in first-letter mode and accepts "I was right"', async () => {
		const env = await setup();
		// The cloze note's second card: its own path is [cloze], so the redo stays a typed recall.
		const material = await loadCourse(env.repos, env.courseId);
		const clozeCard = material.cards.find(
			(card) => material.notes.get(card.noteId)?.type === 'cloze' && card.variant === 'c2'
		)?.id;
		if (!clozeCard) throw new Error('fixture');
		let view = await env.study.startCourse(env.courseId, {
			cardIds: [clozeCard],
			forceKinds: { [clozeCard]: 'cloze' }
		});
		expect(view.item?.exercise.kind).toBe('cloze');
		const wrong = await env.study.submit(view.sessionId, { shape: 'type', typed: 'subnets' });
		expect(wrong.verdict.correct).toBe(false);
		expect(wrong.verdict.reveal).toStrictEqual(['networks']);
		view = wrong.view;
		expect(view.item?.firstAttempt).toBe(false);
		expect(['firstLetterBank', 'firstLetterType']).toContain(view.item?.exercise.kind);
		const accepted = await env.study.acceptTyped(view.sessionId, {
			typed: 'subnets',
			...(wrong.reviewEventId ? { reviewEventId: wrong.reviewEventId } : {})
		});
		expect(accepted.passesGuard).toBe(true);
		const card = await env.repos.cards.get(clozeCard);
		const note = card && (await env.repos.notes.get(card.noteId));
		expect(note?.accept.c2).toContain('subnets');
		const added = (await env.events.list()).filter((event) => event.type === 'acceptAdded');
		expect(added).toMatchObject([{ value: 'subnets', reviewEventId: wrong.reviewEventId }]);
	});

	it('stop keeps the answers and ends the session', async () => {
		const env = await setup();
		let view = await env.study.startCourse(env.courseId);
		const item = view.item;
		if (!item) throw new Error('fixture');
		view = (await env.study.submit(view.sessionId, rightResponse(item.exercise))).view;
		view = await env.study.stop(view.sessionId);
		expect(view.ended).toBe(true);
		expect(view.item).toBeNull();
		expect((await env.events.list()).length).toBe(1);
	});
});
