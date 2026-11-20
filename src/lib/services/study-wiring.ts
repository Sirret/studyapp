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
import { CardListService } from './card-list-service.ts';
import { ImportUndoService } from './import-undo.ts';
import { ManualContentService } from './manual-content-service.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { EventRepo } from '#lib/db/repos/event-repo.ts';
import { KvRepo } from '#lib/db/repos/kv-repo.ts';
import { SessionRepo } from '#lib/db/repos/session-repo.ts';
import { db, logger } from './app.ts';
import { refreshCardPaths } from './path-refresh.ts';
import { kvReplayConfig, ReplayService } from './replay-service.ts';
import { SessionService } from './session-service.ts';
import { StudyService } from './study-service.ts';
import { LearnService } from './learn-service.ts';
import { PracticeService } from './practice-service.ts';
import { ScopeService } from './scope-service.ts';
import { HomeService } from './home-service.ts';

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
const tzOffsetMin = (): number => -new Date().getTimezoneOffset();
const events = new EventRepo(db, { clock, newId, device, tzOffsetMin });
const kv = new KvRepo(db);
/** Minutes east of UTC, as the engine counts study days (BUILD_PLAN §6.1). */
const replayConfig = kvReplayConfig(kv, tzOffsetMin);
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

const content = new ContentStore(db, context);

/** Trashing courses from Today. */
export const courseService = new CourseService(content, logger);

/** The "See all cards" screen: list, edit, delete and flag a course's notes (BUILD_PLAN §10 row 8.5). */
export const cardListService = new CardListService(content, replay, logger);

/** The course page's "Undo import" (DATA_MODEL §3.1 `lastImport`). */
export const importUndoService = new ImportUndoService(content, logger);

/** Manual mode: courses, topics, sections and cards made by hand (Decisions log "Phase 8.6 Q15"). */
export const manualContentService = new ManualContentService(content, logger);

let pathCheck: Promise<void> | null = null;

/**
 * Moves stored cards onto the current exercise paths once (`refreshCardPaths`). Runs at most once
 * per page load; never rejects: a failure is logged and tried again on the next start.
 *
 * @see path-refresh.ts
 */
export function ensureCardPaths(): Promise<void> {
	pathCheck ??= refreshCardPaths({ kv, store: content, replay, logger }).then(
		() => undefined,
		(error: unknown) => logger.error('cards', 'card paths not refreshed', { error: String(error) })
	);
	return pathCheck;
}

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
	shares: (courseId, events) => plannerService.shareOf(courseId, events)
});

/** The course page's "Studying N of M topics · change" and the scope picker (Phase 8.6 Q12). */
export const scopeService = new ScopeService({ repos: planRepos, kv, logger });

/** Learn: topic by topic over the in-scope material (Phase 8.6 Q2, Q3). */
export const learnService = new LearnService({
	repos: planRepos,
	events,
	kv,
	study: studyService,
	logger
});

/** Practice: flashcard deck and quick quiz, never scheduled (Phase 8.6 Q4, Q18). */
export const practiceService = new PracticeService({
	study: studyService,
	repos,
	events,
	kv,
	logger
});

/** Home's "Where you left off" and the Shelf's reading progress (SESSION_NOTES §K). */
export const homeService = new HomeService({ repos: planRepos, events, learn: learnService });
