import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import { ContentStore } from '#lib/db/repos/content-store.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { EventRepo } from '#lib/db/repos/event-repo.ts';
import { createDb, type SnowpackDb } from '#lib/db/schema.ts';
import type { CardId, CourseId, Placement, SessionId, TopicId } from '#lib/db/schemas/common.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import { Logger } from '#lib/log/logger.ts';
import { CardListService } from '#lib/services/card-list-service.ts';
import { ImportService, type ImageEncoder } from '#lib/services/import-service.ts';
import { ImportUndoService } from '#lib/services/import-undo.ts';

const encoder: ImageEncoder = {
	encode: async (source) => ({ ok: true, value: { blob: source, width: 40, height: 20 } })
};

/** A fresh database with the Phase 8.5 services over it, and helpers to import and study. */
export async function setupCardEnv() {
	const db: SnowpackDb = createDb(`cards-${randomUUID()}`);
	let tick = 1_000;
	const clock = () => (tick += 1);
	const device = new DeviceRepo(db, randomUUID);
	const store = new ContentStore(db, {
		clock,
		newId: randomUUID,
		getDeviceId: () => device.getDeviceId()
	});
	const events = new EventRepo(db, { clock, newId: randomUUID, device });
	const logger = new Logger({ sink: { append: async () => {} }, clock });
	const importer = new ImportService(store, encoder, randomUUID, logger);
	const replay = { rebuildCards: vi.fn(async (_ids: readonly CardId[]) => {}) };
	const cardList = new CardListService(store, replay, logger);
	const undo = new ImportUndoService(store, logger);
	const course = await importer.createCourse('Networks');
	const courseId = course.id as CourseId;

	/** Imports a reply into the course; fails the test when the commit fails. */
	async function importText(
		text: string,
		images: string[] = [],
		placements: ReadonlyMap<string, Placement> = new Map()
	): Promise<void> {
		const sources = images.map((name) => ({ name, blob: new Blob([name], { type: 'image/png' }) }));
		const prepared = (await importer.prepareImages(sources)).images;
		const preview = await importer.preview(courseId, text, prepared);
		const result = await importer.commit(courseId, preview, placements);
		if (!result.ok) throw new Error(`import failed: ${result.error}`);
	}

	/** Live notes of the course, in topic then note order. */
	async function notes(): Promise<Note[]> {
		const topics = await store.topics.listByCourse(courseId);
		const lists = await Promise.all(topics.map((topic) => store.notes.listByTopic(topic.id)));
		return lists.flat();
	}

	/** The live note whose payload mentions this text. */
	async function noteWith(text: string): Promise<Note> {
		const found = (await notes()).find((note) => JSON.stringify(note.payload).includes(text));
		if (!found) throw new Error(`no note with ${text}`);
		return found;
	}

	/** Records one answer for a card (an event only; caches are replay's job). */
	async function answer(cardId: CardId): Promise<void> {
		await events.append({
			type: 'review',
			cardId,
			sessionId: randomUUID() as SessionId,
			mode: 'longterm',
			kind: 'cloze',
			weight: 'full',
			firstAttempt: true,
			correct: true,
			responseMs: 10,
			credited: true
		});
	}

	async function topicIds(): Promise<TopicId[]> {
		return (await store.topics.listByCourse(courseId)).map((topic) => topic.id);
	}

	return {
		db,
		store,
		events,
		importer,
		replay,
		cardList,
		undo,
		courseId,
		importText,
		notes,
		noteWith,
		answer,
		topicIds
	};
}

export type CardEnv = Awaited<ReturnType<typeof setupCardEnv>>;
