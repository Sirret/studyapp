import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
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
import { createDb, type SnowpackDb } from '#lib/db/schema.ts';
import type { CourseId } from '#lib/db/schemas/common.ts';
import { Logger } from '#lib/log/logger.ts';
import { ImportService, type ImageEncoder } from '#lib/services/import-service.ts';
import { kvReplayConfig, ReplayService } from '#lib/services/replay-service.ts';
import { SessionService } from '#lib/services/session-service.ts';
import { StudyService } from '#lib/services/study-service.ts';
import type { ExerciseResponse, ExerciseSpec } from '#lib/services/study-types.ts';

/**
 * A real study stack (repos, events, replay, sessions, StudyService) on a fresh fake database,
 * with one course imported from `text`. The caller deletes `db` after each test.
 */
export async function studyStack(text: string, start = Date.UTC(2026, 2, 10, 12)) {
	const db: SnowpackDb = createDb(`study-${randomUUID()}`);
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
	const sessionRepo = new SessionRepo(db);
	const sessions = new SessionService({
		sessions: sessionRepo,
		events,
		cards: repos.cards,
		replay,
		replayConfig,
		clock,
		newId: randomUUID,
		logger
	});
	const study = new StudyService({ sessions, repos, events, kv, replay, clock, logger });
	const encoder: ImageEncoder = { encode: async () => ({ ok: false, error: 'no images' }) };
	const importer = new ImportService(new ContentStore(db, context), encoder, randomUUID, logger);
	const course = await importer.createCourse('Networking');
	const preview = await importer.preview(course.id, text, []);
	expect(preview.errors).toStrictEqual([]);
	const committed = await importer.commit(course.id, preview, new Map());
	expect(committed.ok).toBe(true);
	return {
		db,
		clock,
		repos,
		events,
		kv,
		logger,
		replay,
		replayConfig,
		sessionRepo,
		sessions,
		study,
		courseId: course.id as CourseId
	};
}

export type StudyStack = Awaited<ReturnType<typeof studyStack>>;

/** The right response to a spec, as a student who knows everything gives it. */
export function rightResponse(spec: ExerciseSpec): ExerciseResponse {
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
		case 'ideaUnit':
			return { shape: 'ideaUnit', typed: spec.answer, ticked: spec.keyWords.map((_word, i) => i) };
		case 'list':
			return spec.entry === 'type'
				? { shape: 'list', typed: spec.items, picked: [] }
				: { shape: 'list', typed: [], picked: spec.correct };
		case 'selfRate':
			return { shape: 'selfRate', checked: spec.checklist.map((_c, i) => i), rating: 'good' };
		case 'study':
			return { shape: 'study' };
	}
}
