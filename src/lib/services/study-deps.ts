import type {
	CardRepo,
	CourseRepo,
	MediaRepo,
	NoteRepo,
	TopicRepo
} from '#lib/db/repos/content-repos.ts';
import type { EventRepo } from '#lib/db/repos/event-repo.ts';
import type { KvRepo } from '#lib/db/repos/kv-repo.ts';
import type { Logger } from '#lib/log/logger.ts';
import type { ReplayService } from './replay-service.ts';
import type { SessionService } from './session-service.ts';

/**
 * What `StudyService` needs; injected so tests can pass real repos on a fake database.
 *
 * @see BUILD_PLAN §15 (services take their dependencies)
 */
export interface StudyServiceDeps {
	sessions: SessionService;
	repos: {
		courses: CourseRepo;
		topics: TopicRepo;
		notes: NoteRepo;
		cards: CardRepo;
		media: MediaRepo;
	};
	events: EventRepo;
	kv: KvRepo;
	replay: ReplayService;
	clock: () => number;
	logger: Logger;
}
