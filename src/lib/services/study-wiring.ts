import {
	CardRepo,
	ChunkRepo,
	CourseRepo,
	NoteRepo,
	TopicRepo
} from '#lib/db/repos/content-repos.ts';
import { ContentStore } from '#lib/db/repos/content-store.ts';
import { CoursePlanService } from './course-plan-service.ts';
import { PlannerService } from './planner-service.ts';
import { CourseService } from './course-service.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { EventRepo } from '#lib/db/repos/event-repo.ts';
import { KvRepo } from '#lib/db/repos/kv-repo.ts';
import { SessionRepo } from '#lib/db/repos/session-repo.ts';
import { db, logger } from './app.ts';
import { kvReplayConfig, ReplayService } from './replay-service.ts';
import { SessionService } from './session-service.ts';
import { StudyService } from './study-service.ts';

const newId = () => crypto.randomUUID();
const clock = () => Date.now();
const device = new DeviceRepo(db, newId);
const context = { clock, newId, getDeviceId: () => device.getDeviceId() };
const repos = {
	courses: new CourseRepo(db, context),
	topics: new TopicRepo(db, context),
	notes: new NoteRepo(db, context),
	cards: new CardRepo(db, context)
};
const events = new EventRepo(db, { clock, newId, device });
const kv = new KvRepo(db);
/** Minutes east of UTC, as the engine counts study days (BUILD_PLAN §6.1). */
const replayConfig = kvReplayConfig(kv, () => -new Date().getTimezoneOffset());
const replay = new ReplayService(events, repos.cards, logger, replayConfig);
const sessions = new SessionService({
	sessions: new SessionRepo(db),
	events,
	cards: repos.cards,
	replay,
	replayConfig,
	clock,
	newId,
	logger
});

/**
 * The study screen's service. A separate module, imported only by the study routes, so the
 * engine, zod and the repositories stay out of the app shell.
 *
 * @see CLAUDE.md rule 9
 */
/** The repositories the study service reads, for dev tooling in this layer. */
export const studyRepos = repos;

export const studyService = new StudyService({
	sessions,
	repos,
	events,
	kv,
	replay,
	clock,
	logger
});

/** Trashing courses from Today. */
export const courseService = new CourseService(new ContentStore(db, context), logger);

const planRepos = { ...repos, chunks: new ChunkRepo(db, context) };

/** Today, the Plan screen and the availability calendar (BUILD_PLAN §6.9). */
export const plannerService = new PlannerService({
	repos: planRepos,
	events,
	kv,
	replayConfig,
	clock,
	logger
});

/** The course page: today's modes, review, learn units and one-night (BUILD_PLAN §6.6–§6.8). */
export const coursePlanService = new CoursePlanService({
	repos: planRepos,
	events,
	kv,
	study: studyService,
	replayConfig,
	clock,
	logger,
	shares: (courseId) => plannerService.shareOf(courseId)
});
