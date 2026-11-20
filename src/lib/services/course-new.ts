import { DEFAULT_EXAM_FORMAT } from '#lib/config/defaults.ts';
import type { CourseRepo } from '#lib/db/repos/content-repos.ts';
import { CourseColorSchema, type CourseColor } from '#lib/db/schemas/common.ts';
import type { Course } from '#lib/db/schemas/course.ts';

/**
 * Creates an empty, active course with the default exam format and the next colour in turn. Used
 * by the import screen and by Manual mode, so both start a course the same way.
 *
 * @see DATA_MODEL §3.1
 */
export async function createEmptyCourse(courses: CourseRepo, name: string): Promise<Course> {
	const colors = CourseColorSchema.options;
	const existing = await courses.list();
	return courses.create({
		name,
		status: 'active',
		examFormat: DEFAULT_EXAM_FORMAT,
		color: colors[existing.length % colors.length] as CourseColor
	});
}
