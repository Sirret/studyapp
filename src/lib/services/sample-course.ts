import type { KvRepo } from '#lib/db/repos/kv-repo.ts';
import type { CourseId } from '#lib/db/schemas/common.ts';
import type { Course } from '#lib/db/schemas/course.ts';
import type { ImportService } from './import-service.ts';

/** The name of the built-in course a first-time student can try. */
export const SAMPLE_COURSE_NAME = 'Sample: Network security';

/**
 * What a "Try a sample course" tap did. `has-courses`: the student already has courses (Welcome
 * only offers the sample when there are none), so nothing is added.
 */
export type SampleCourseOutcome = { kind: 'added'; courseId: CourseId } | { kind: 'has-courses' };

export interface SampleCourseDeps {
	kv: Pick<KvRepo, 'set'>;
	courses: { list(): Promise<readonly Course[]> };
	importer: Pick<ImportService, 'createCourse' | 'preview' | 'commit'>;
	/** The sample reply text (loaded lazily, outside the app shell). */
	loadText: () => Promise<string>;
}

/**
 * Adds the sample course when the student taps "Try a sample course" on Welcome and has no
 * courses. A student who deleted it and is back on Welcome can add it again. Sets the kv flag
 * `sampleCourseSeeded` (a record that the sample was added at least once). A failure throws and
 * leaves the flag as it was.
 *
 * @see docs/BUILD_PLAN.md Decisions log, "Phase 8.6 Q17"
 */
export async function seedSampleCourse(deps: SampleCourseDeps): Promise<SampleCourseOutcome> {
	if ((await deps.courses.list()).length > 0) return { kind: 'has-courses' };
	const course = await deps.importer.createCourse(SAMPLE_COURSE_NAME);
	const preview = await deps.importer.preview(course.id, await deps.loadText(), []);
	if (preview.errors.length > 0) {
		throw new Error(`The sample course has ${preview.errors.length} parse errors`);
	}
	const committed = await deps.importer.commit(course.id, preview, new Map());
	if (!committed.ok) throw new Error(committed.error);
	await deps.kv.set('sampleCourseSeeded', true);
	return { kind: 'added', courseId: course.id };
}
