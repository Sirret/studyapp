import type { KvRepo } from '#lib/db/repos/kv-repo.ts';
import type { Course } from '#lib/db/schemas/course.ts';
import type { ImportService } from './import-service.ts';

/** The name of the built-in course a first-time student gets. */
export const SAMPLE_COURSE_NAME = 'Sample: Network security';

/**
 * What the first-run check did. `already-seeded`: the flag is set, so the sample never comes back
 * (even after the student deletes it). `has-courses`: the student already had courses, so the
 * sample is not added and the flag is set.
 */
export type SampleCourseOutcome = 'added' | 'already-seeded' | 'has-courses';

export interface SampleCourseDeps {
	kv: Pick<KvRepo, 'get' | 'set'>;
	courses: { list(): Promise<readonly Course[]> };
	importer: Pick<ImportService, 'createCourse' | 'preview' | 'commit'>;
	/** The sample reply text (loaded lazily, outside the app shell). */
	loadText: () => Promise<string>;
}

/**
 * Adds the sample course once, on the first run with no courses. Sets the kv flag
 * `sampleCourseSeeded` whenever it decides, so a later start never repeats it. A failure throws
 * and leaves the flag unset, so the next start tries again.
 *
 * @see docs/BUILD_PLAN.md Decisions log, "Default course"
 */
export async function seedSampleCourse(deps: SampleCourseDeps): Promise<SampleCourseOutcome> {
	if ((await deps.kv.get('sampleCourseSeeded')) === true) return 'already-seeded';
	if ((await deps.courses.list()).length > 0) {
		await deps.kv.set('sampleCourseSeeded', true);
		return 'has-courses';
	}
	const course = await deps.importer.createCourse(SAMPLE_COURSE_NAME);
	const preview = await deps.importer.preview(course.id, await deps.loadText(), []);
	if (preview.errors.length > 0) {
		throw new Error(`The sample course has ${preview.errors.length} parse errors`);
	}
	const committed = await deps.importer.commit(course.id, preview, new Map());
	if (!committed.ok) throw new Error(committed.error);
	await deps.kv.set('sampleCourseSeeded', true);
	return 'added';
}
