import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { DAILY_FLOOR_MIN, PLAN_FORECAST_DAYS } from '#lib/config/defaults.ts';
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
import type { CardId, CourseId, SessionId } from '#lib/db/schemas/common.ts';
import { DEFAULT_AVAILABILITY, type Availability } from '#lib/db/schemas/kv.ts';
import { dayIndex, localDateOf, MS_PER_MINUTE } from '#lib/engine/time.ts';
import { Logger } from '#lib/log/logger.ts';
import { CoursePlanService } from '#lib/services/course-plan-service.ts';
import { ImportService, type ImageEncoder } from '#lib/services/import-service.ts';
import { PlannerService } from '#lib/services/planner-service.ts';
import { kvReplayConfig, ReplayService } from '#lib/services/replay-service.ts';
import { SessionService } from '#lib/services/session-service.ts';
import { StudyService } from '#lib/services/study-service.ts';

/**
 * PlannerService (BUILD_PLAN §6.9 "The planner, concretely"): builds the planner's input from
 * stored courses, serves Today, the Plan screen and the availability calendar, and feeds each
 * course's share into the course page.
 */

const TEXT = (name: string): string => `@deck ${name}
@keyterms
${name} port :: number that names a service on a host
${name} packet :: unit of data sent across a network
@read
${name} is about reliable delivery. It has a handshake and acknowledgements for every segment.
@fact
${name} TCP :: connection-oriented, reliable delivery
${name} UDP :: connectionless, best-effort delivery
@end
`;

let db = createDb(`planner-${randomUUID()}`);
const start = Date.UTC(2026, 2, 10, 12);
const encoder: ImageEncoder = { encode: async () => ({ ok: false, error: 'no images' }) };

afterEach(async () => {
	await db.delete();
});

async function setup() {
	db = createDb(`planner-${randomUUID()}`);
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
	const planner = new PlannerService({ repos, events, kv, replayConfig, clock, logger });
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
	const plans = new CoursePlanService({
		repos,
		events,
		kv,
		study,
		replayConfig,
		clock,
		logger,
		shares: (id) => planner.shareOf(id)
	});
	const importer = new ImportService(new ContentStore(db, context), encoder, randomUUID, logger);
	const addCourse = async (name: string): Promise<CourseId> => {
		const course = await importer.createCourse(name);
		const preview = await importer.preview(course.id, TEXT(name), []);
		expect((await importer.commit(course.id, preview, new Map())).ok).toBe(true);
		return course.id as CourseId;
	};
	const today = dayIndex(start, 0);
	const examIn = async (courseId: CourseId, days: number): Promise<void> => {
		await plans.setExam(courseId, {
			examDate: localDateOf(today + days),
			examTime: '09:00',
			examFormat: 'mixed'
		});
	};
	return { planner, plans, repos, events, kv, addCourse, examIn, today };
}

const minutesEvery = (minutes: number): Availability => ({
	...DEFAULT_AVAILABILITY,
	weekdayMinutes: Array.from({ length: 7 }, () => minutes)
});

describe('PlannerService (BUILD_PLAN §6.9)', { timeout: 30_000 }, () => {
	it('with no exams: nothing is planned, Today lists the courses, the week shows availability', async () => {
		const env = await setup();
		await env.addCourse('Networks');
		const today = await env.planner.today();
		expect(today.courses).toHaveLength(1);
		expect(today.courses[0]).toMatchObject({ name: 'Networks', plannedMinutes: null });
		expect(today.courses[0]?.unitsToLearn).toBeGreaterThan(0);
		expect(today.shortfall).toBeNull();
		expect(today.done).toBe(false);
		const week = await env.planner.week();
		expect(week.days).toHaveLength(PLAN_FORECAST_DAYS);
		expect(week.days[0]).toMatchObject({ today: true, date: localDateOf(env.today) });
		expect(week.days.every((day) => day.segments.length === 0)).toBe(true);
		expect(week.exams).toStrictEqual([]);
		expect(week.feasible).toBe(true);
	});

	it('shares today across two exam courses, each with at least the floor, within the day', async () => {
		const env = await setup();
		const a = await env.addCourse('Networks');
		const b = await env.addCourse('Databases');
		await env.examIn(a, 2);
		await env.examIn(b, 4);
		await env.planner.setAvailability(minutesEvery(120));
		const today = await env.planner.today();
		const planned = today.courses.map((c) => c.plannedMinutes ?? 0);
		expect(planned.every((m) => m >= DAILY_FLOOR_MIN)).toBe(true);
		expect(planned.reduce((x, y) => x + y, 0)).toBeLessThanOrEqual(120);
		expect(today.courses.find((c) => c.id === a)?.daysToExam).toBe(2);
		const week = await env.planner.week();
		expect(week.days[2]?.exams.map((e) => e.courseId)).toStrictEqual([a]);
		expect(week.days[4]?.exams.map((e) => e.courseId)).toStrictEqual([b]);
		expect(week.exams.map((e) => e.courseId)).toStrictEqual([a, b]);
		expect(week.exams.every((e) => e.fits)).toBe(true);
		expect(week.feasible).toBe(true);
	});

	it('with no time before the exams, names the first exam short and suggests cuts', async () => {
		const env = await setup();
		const a = await env.addCourse('Networks');
		const b = await env.addCourse('Databases');
		await env.examIn(a, 1);
		await env.examIn(b, 3);
		await env.planner.setAvailability({ ...minutesEvery(0), examMorningMinutes: 0 });
		const today = await env.planner.today();
		expect(today.shortfall).toMatchObject({ courseId: a, examDate: localDateOf(env.today + 1) });
		expect(today.shortfall?.shortfallMinutes).toBeGreaterThan(0);
		expect(today.shortfall?.cutCount).toBeGreaterThan(0);
		const week = await env.planner.week();
		expect(week.feasible).toBe(false);
		const first = week.exams[0];
		expect(first).toMatchObject({ courseId: a, fits: false, availableMinutes: 0 });
		expect(first?.degradations).toStrictEqual(['criterion', 'relearning', 'cut']);
	});

	it('validates and saves availability; overrides are de-duplicated, sorted and used', async () => {
		const env = await setup();
		await expect(
			env.planner.setAvailability({ ...DEFAULT_AVAILABILITY, weekdayMinutes: [10, 10] })
		).rejects.toThrow();
		const tomorrow = localDateOf(env.today + 1);
		const later = localDateOf(env.today + 2);
		await env.planner.setAvailability({
			...minutesEvery(60),
			overrides: [
				{ date: later, minutes: 5 },
				{ date: tomorrow, minutes: 30 },
				{ date: tomorrow, minutes: 45 }
			]
		});
		const saved = await env.planner.availability();
		expect(saved.overrides).toStrictEqual([
			{ date: tomorrow, minutes: 45 },
			{ date: later, minutes: 5 }
		]);
		const week = await env.planner.week();
		expect(week.days.slice(0, 3).map((d) => d.capMinutes)).toStrictEqual([60, 45, 5]);
	});

	it("today's minutes shrink by what was already studied today", async () => {
		const env = await setup();
		await env.planner.setAvailability(minutesEvery(60));
		const card = (await env.repos.cards.listByCourse(await env.addCourse('Networks')))[0];
		await env.events.append({
			type: 'pretest',
			cardId: card?.id as CardId,
			sessionId: randomUUID() as SessionId,
			skipped: false,
			responseMs: 20 * MS_PER_MINUTE
		});
		const week = await env.planner.week();
		expect(week.days[0]?.capMinutes).toBe(40);
		expect((await env.planner.today()).studiedMinutes).toBe(20);
	});

	it("a course's share is its split minutes plus the free minutes, one entry per day before the exam", async () => {
		const env = await setup();
		const a = await env.addCourse('Networks');
		const b = await env.addCourse('Databases');
		expect(await env.planner.shareOf(a)).toBeNull();
		await env.examIn(a, 3);
		await env.planner.setAvailability(minutesEvery(90));
		const share = await env.planner.shareOf(a);
		expect(share).toHaveLength(3);
		const week = await env.planner.week();
		share?.forEach((minutes, i) => {
			const day = week.days[i];
			const own = day?.segments.find((s) => s.courseId === a)?.minutes ?? 0;
			expect(minutes).toBe(own + (day?.freeMinutes ?? 0));
		});
		expect(await env.planner.shareOf(b)).toBeNull();
	});

	it('the course page plans cram against its share, and a past exam leaves the planner', async () => {
		const env = await setup();
		const a = await env.addCourse('Networks');
		await env.examIn(a, -1);
		expect(await env.planner.shareOf(a)).toBeNull();
		expect((await env.planner.today()).courses[0]?.plannedMinutes).toBeNull();
		await env.examIn(a, 3);
		const page = await env.plans.today(a);
		expect(page.daysToExam).toBe(3);
		expect(page.learn?.mode).toBe('acquisition');
	});
});
