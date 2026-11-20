import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { ContentStore } from '#lib/db/repos/content-store.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { KvRepo } from '#lib/db/repos/kv-repo.ts';
import { createDb } from '#lib/db/schema.ts';
import { SAMPLE_COURSE_REPLY } from '#lib/content/sample-course.ts';
import { Logger } from '#lib/log/logger.ts';
import { ImportService, type ImageEncoder } from '#lib/services/import-service.ts';
import {
	SAMPLE_COURSE_NAME,
	seedSampleCourse,
	type SampleCourseDeps
} from '#lib/services/sample-course.ts';

const FIXTURE = new URL('../../fixtures/import/security_reply.txt', import.meta.url);
const encoder: ImageEncoder = { encode: async () => ({ ok: false, error: 'no images' }) };

let db = createDb(`sample-${randomUUID()}`);

afterEach(async () => {
	await db.delete();
});

/** A fresh database with the real repos, and the seeder's dependencies wired to it. */
function setup(): { deps: SampleCourseDeps; store: ContentStore; kv: KvRepo } {
	db = createDb(`sample-${randomUUID()}`);
	const newId = randomUUID;
	const clock = () => Date.now();
	const device = new DeviceRepo(db, newId);
	const store = new ContentStore(db, { clock, newId, getDeviceId: () => device.getDeviceId() });
	const logger = new Logger({ sink: { append: async () => {} }, clock });
	const importer = new ImportService(store, encoder, newId, logger);
	const kv = new KvRepo(db);
	const deps: SampleCourseDeps = {
		kv,
		courses: store.courses,
		importer,
		loadText: async () => SAMPLE_COURSE_REPLY
	};
	return { deps, store, kv };
}

describe('sample course on tap (BUILD_PLAN Decisions log, "Phase 8.6 Q17")', () => {
	it('the bundled reply is the security fixture, byte for byte (no drift)', () => {
		expect(SAMPLE_COURSE_REPLY).toBe(readFileSync(FIXTURE, 'utf8'));
	});

	it('adds the course with its map when the student has no courses, and sets the flag', async () => {
		const { deps, store, kv } = setup();
		const outcome = await seedSampleCourse(deps);
		const courses = await store.courses.list();
		expect(courses.map((course) => course.name)).toStrictEqual([SAMPLE_COURSE_NAME]);
		expect(outcome).toStrictEqual({ kind: 'added', courseId: courses[0]?.id });
		expect(courses[0]?.map?.topics).toHaveLength(8);
		expect(await kv.get('sampleCourseSeeded')).toBe(true);
	});

	it('a student who deleted the sample and is back on Welcome can add it again', async () => {
		const { deps, store } = setup();
		await seedSampleCourse(deps);
		for (const course of await store.courses.list()) await store.courses.softDelete(course.id);
		expect((await seedSampleCourse(deps)).kind).toBe('added');
		expect((await store.courses.list()).map((course) => course.name)).toStrictEqual([
			SAMPLE_COURSE_NAME
		]);
	});

	it('a student who already has a course keeps it; the sample is not added', async () => {
		const { deps, store } = setup();
		await deps.importer.createCourse('My own course');
		expect(await seedSampleCourse(deps)).toStrictEqual({ kind: 'has-courses' });
		expect((await store.courses.list()).map((course) => course.name)).toStrictEqual([
			'My own course'
		]);
	});

	it('a failed import throws and leaves the flag unset', async () => {
		const { deps, kv } = setup();
		const broken: SampleCourseDeps = {
			...deps,
			importer: {
				createCourse: deps.importer.createCourse.bind(deps.importer),
				preview: async () => ({ errors: [{ line: 1, message: 'broken' }] }) as never,
				commit: deps.importer.commit.bind(deps.importer)
			}
		};
		await expect(seedSampleCourse(broken)).rejects.toThrow(/parse errors/);
		expect(await kv.get('sampleCourseSeeded')).toBeUndefined();
	});
});
