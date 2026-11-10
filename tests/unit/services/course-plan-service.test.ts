import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import {
	CardRepo,
	ChunkRepo,
	CourseRepo,
	NoteRepo,
	TopicRepo
} from '#lib/db/repos/content-repos.ts';
import { ContentStore } from '#lib/db/repos/content-store.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { EventRepo } from '#lib/db/repos/event-repo.ts';
import { KvRepo } from '#lib/db/repos/kv-repo.ts';
import { SessionRepo } from '#lib/db/repos/session-repo.ts';
import { createDb } from '#lib/db/schema.ts';
import type { CourseId } from '#lib/db/schemas/common.ts';
import { localDateOf, MS_PER_DAY, dayIndex } from '#lib/engine/time.ts';
import { Logger } from '#lib/log/logger.ts';
import { CoursePlanService } from '#lib/services/course-plan-service.ts';
import { ImportService, type ImageEncoder } from '#lib/services/import-service.ts';
import { kvReplayConfig, ReplayService } from '#lib/services/replay-service.ts';
import { SessionService } from '#lib/services/session-service.ts';
import { StudyService } from '#lib/services/study-service.ts';
import type { ExerciseResponse, ExerciseSpec, StudyView } from '#lib/services/study-types.ts';

/** Two topics with chunks, key terms and facts; topics start as "haven't read". */
const COURSE_TEXT = `@deck Transport
@keyterms
Port :: number that names a service on a host
Packet :: unit of data sent across a network
@read
TCP is a reliable, connection-oriented transport protocol. UDP is a connectionless one with no delivery guarantee.
@fact
TCP :: connection-oriented, reliable delivery
UDP :: connectionless, best-effort delivery
@deck Addressing
@read
An IP address identifies a host on a network. A subnet mask splits it into network and host parts.
@fact
DNS :: turns names into IP addresses
DHCP :: hands out IP addresses automatically
@end
`;

let db = createDb(`plan-${randomUUID()}`);
const start = Date.UTC(2026, 2, 10, 12);
const encoder: ImageEncoder = { encode: async () => ({ ok: false, error: 'no images' }) };

afterEach(async () => {
	await db.delete();
});

async function setup() {
	db = createDb(`plan-${randomUUID()}`);
	let tick = start;
	const clock = () => (tick += 1000);
	const device = new DeviceRepo(db, randomUUID);
	const context = { clock, newId: randomUUID, getDeviceId: () => device.getDeviceId() };
	const repos = {
		courses: new CourseRepo(db, context),
		topics: new TopicRepo(db, context),
		chunks: new ChunkRepo(db, context),
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
	const plans = new CoursePlanService({ repos, events, kv, study, replayConfig, clock, logger });
	const importer = new ImportService(new ContentStore(db, context), encoder, randomUUID, logger);
	const course = await importer.createCourse('Networking');
	const preview = await importer.preview(course.id, COURSE_TEXT, []);
	expect(preview.errors).toStrictEqual([]);
	expect((await importer.commit(course.id, preview, new Map())).ok).toBe(true);
	const advanceDays = (days: number): void => {
		tick += days * MS_PER_DAY;
	};
	const today = (): string => localDateOf(dayIndex(tick, 0));
	return { plans, study, repos, events, advanceDays, today, courseId: course.id as CourseId };
}

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

const wrong: ExerciseResponse = { shape: 'type', typed: 'zzz' };

/** Answers until the session ends: right, or wrong on every first attempt when `miss`. */
async function finish(study: StudyService, first: StudyView, miss = false): Promise<StudyView> {
	let view = first;
	for (let guard = 0; guard < 200 && !view.ended; guard++) {
		if (view.round) view = await study.continueRound(view.sessionId, { afterBreak: false });
		else if (view.item) {
			const item = view.item;
			const response =
				miss && item.firstAttempt && item.exercise.shape === 'type'
					? wrong
					: rightResponse(item.exercise);
			view = (await study.submit(view.sessionId, response)).view;
		} else view = await study.stop(view.sessionId);
	}
	return view;
}

/** Runs every session step of a unit. */
async function learnAll(env: Awaited<ReturnType<typeof setup>>, key: string, miss = false) {
	const unit = await env.plans.learnUnit(env.courseId, key);
	if (!unit) throw new Error('no unit');
	const sessions: string[] = [];
	for (const [index, step] of unit.steps.entries()) {
		if (step.step === 'read') continue;
		const view = await finish(
			env.study,
			await env.plans.startLearnStep(env.courseId, key, index),
			miss && step.step === 'quiz'
		);
		if (step.step === 'quiz') sessions.push(view.sessionId);
	}
	return { unit, quizSessions: sessions };
}

/** These run several real sessions on a fake database; the default 5 s is too short under load. */
const SESSION_TEST_MS = 30_000;

describe(
	'CoursePlanService (BUILD_PLAN §6.6–§6.8, Decisions log Phase 7)',
	{ timeout: SESSION_TEST_MS },
	() => {
		it('with no exam and unread topics: long-term review has nothing yet, acquisition lists units', async () => {
			const env = await setup();
			const today = await env.plans.today(env.courseId);
			expect(today.daysToExam).toBeNull();
			expect(today.review).toMatchObject({ kind: 'longterm', cards: 0 });
			expect(today.learn?.mode).toBe('acquisition');
			if (today.learn?.mode !== 'acquisition') return;
			expect(today.learn.units.length).toBeGreaterThanOrEqual(2);
			for (const unit of today.learn.units) {
				expect(unit.minutes).toBeGreaterThan(0);
				expect(unit.steps).toBeGreaterThan(0);
			}
		});

		it('an exam within CRAM_MAX_DAYS switches review to cram; tomorrow with unread material is one-night', async () => {
			const env = await setup();
			const inDays = (days: number) => localDateOf(dayIndex(start, 0) + days);
			await env.plans.setExam(env.courseId, {
				examDate: inDays(3),
				examTime: null,
				examFormat: 'recall'
			});
			const cram = await env.plans.today(env.courseId);
			expect(cram.daysToExam).toBe(3);
			expect(cram.review.kind).toBe('cram');
			expect(cram.review.cram).not.toBeNull();
			expect(cram.learn?.mode).toBe('acquisition');
			await env.plans.setExam(env.courseId, {
				examDate: inDays(1),
				examTime: '09:00',
				examFormat: 'mixed'
			});
			const night = await env.plans.today(env.courseId);
			expect(night.learn?.mode).toBe('onenight');
			await env.plans.setExam(env.courseId, {
				examDate: null,
				examTime: null,
				examFormat: 'mixed'
			});
			expect((await env.plans.today(env.courseId)).daysToExam).toBeNull();
		});

		it('acquisition answers are uncredited, and the cards are retested the next study day', async () => {
			const env = await setup();
			const today = await env.plans.today(env.courseId);
			if (today.learn?.mode !== 'acquisition') throw new Error('expected acquisition');
			const key = today.learn.units[0]!.key;
			await learnAll(env, key);
			const reviews = (await env.events.list()).filter((event) => event.type === 'review');
			expect(reviews.length).toBeGreaterThan(0);
			for (const event of reviews)
				expect(event).toMatchObject({ mode: 'acquisition', credited: false });
			const after = await env.plans.today(env.courseId);
			expect(after.review.cards).toBe(0);
			if (after.learn?.mode === 'acquisition') {
				expect(after.learn.units.map((unit) => unit.key)).not.toContain(key);
			}
			env.advanceDays(1);
			const tomorrow = await env.plans.today(env.courseId);
			expect(tomorrow.review.cards).toBeGreaterThan(0);
			const retest = await env.plans.startReview(env.courseId);
			expect(retest.mode).toBe('longterm');
		});

		it('sets the split flag when first-attempt quiz accuracy is below SPLIT_THRESHOLD', async () => {
			const env = await setup();
			const today = await env.plans.today(env.courseId);
			if (today.learn?.mode !== 'acquisition') throw new Error('expected acquisition');
			const key = today.learn.units[0]!.key;
			const { unit, quizSessions } = await learnAll(env, key, true);
			const read = unit.steps.find((step) => step.step === 'read');
			if (read?.step !== 'read') throw new Error('expected a read step');
			const flagged = await env.plans.finishQuiz(
				env.courseId,
				quizSessions[0] as never,
				read.chunkId
			);
			expect(flagged).toBe(true);
			expect((await env.repos.chunks.get(read.chunkId))?.splitFlag).toBe(true);
		});

		it('one-night block 2 re-quizzes the cards met tonight, logged as one-night', async () => {
			const env = await setup();
			await env.plans.setExam(env.courseId, {
				examDate: localDateOf(dayIndex(start, 0) + 1),
				examTime: '09:00',
				examFormat: 'mixed'
			});
			const night = await env.plans.today(env.courseId);
			if (night.learn?.mode !== 'onenight') throw new Error('expected one-night');
			const key = night.learn.plan.chosen[0]!.key;
			await learnAll(env, key);
			const after = await env.plans.today(env.courseId);
			if (after.learn?.mode !== 'onenight') throw new Error('expected one-night');
			expect(after.learn.plan.block2Cards).toBeGreaterThan(0);
			const block2 = await env.plans.startBlockTwo(env.courseId);
			expect(block2.mode).toBe('onenight');
			expect(block2.progress.total).toBe(after.learn.plan.block2Cards);
			const reviews = (await env.events.list()).filter((event) => event.type === 'review');
			for (const event of reviews)
				expect(event).toMatchObject({ mode: 'onenight', credited: true });
		});
	}
);
