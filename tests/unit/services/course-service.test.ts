import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { ContentStore } from '#lib/db/repos/content-store.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { createDb } from '#lib/db/schema.ts';
import type { CourseId } from '#lib/db/schemas/common.ts';
import { Logger } from '#lib/log/logger.ts';
import { CourseService } from '#lib/services/course-service.ts';
import { SAMPLE_COURSE_TEXT } from '#lib/services/dev-sample.ts';
import { ImportService, type ImageEncoder } from '#lib/services/import-service.ts';

let db = createDb(`course-${randomUUID()}`);
const encoder: ImageEncoder = { encode: async () => ({ ok: false, error: 'no images' }) };

afterEach(async () => {
	await db.delete();
});

async function setup() {
	db = createDb(`course-${randomUUID()}`);
	let tick = 1_000;
	const clock = () => (tick += 1);
	const device = new DeviceRepo(db, randomUUID);
	const store = new ContentStore(db, {
		clock,
		newId: randomUUID,
		getDeviceId: () => device.getDeviceId()
	});
	const logger = new Logger({ sink: { append: async () => {} }, clock });
	const importer = new ImportService(store, encoder, randomUUID, logger);
	const imported = async (name: string) => {
		const course = await importer.createCourse(name);
		const preview = await importer.preview(course.id, SAMPLE_COURSE_TEXT, []);
		await importer.commit(course.id, preview, new Map());
		return course.id as CourseId;
	};
	return { store, service: new CourseService(store, logger), imported };
}

describe('CourseService.trash (Decisions log: trash a course)', () => {
	it('hides the course and everything in it, as tombstones, and leaves other courses alone', async () => {
		const env = await setup();
		const gone = await env.imported('Networking');
		const kept = await env.imported('Databases');
		const keptCards = (await env.store.cards.listByCourse(kept)).length;

		await env.service.trash(gone);

		expect(await env.store.courses.get(gone)).toBeUndefined();
		expect(await env.store.topics.listByCourse(gone)).toStrictEqual([]);
		expect(await env.store.cards.listByCourse(gone)).toStrictEqual([]);
		expect((await env.store.courses.list()).map((course) => course.id)).toStrictEqual([kept]);
		expect((await env.store.cards.listByCourse(kept)).length).toBe(keptCards);

		const rawCards = await db.cards.where('courseId').equals(gone).toArray();
		expect(rawCards.length).toBeGreaterThan(0);
		expect(rawCards.every((card) => card.deleted)).toBe(true);
		const rawNotes = await db.notes.where('courseId').equals(gone).toArray();
		expect(rawNotes.every((note) => note.deleted)).toBe(true);
	});

	it('does nothing for a course that is already gone', async () => {
		const env = await setup();
		await expect(env.service.trash(randomUUID() as CourseId)).resolves.toBeUndefined();
	});
});
