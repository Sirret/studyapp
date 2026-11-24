import type { CourseId } from '#lib/db/schemas/common.ts';
import type { Course } from '#lib/db/schemas/course.ts';
import { compareText } from '#lib/engine/replay.ts';

/**
 * Courses most recently used first: the later of the course's own last change (`updatedAt`: an
 * import, an exam date) and the last session it was in; ties by name. The import screen lists
 * its courses this way (Decisions "UX fix: import course picker").
 */
export function recentFirst<C extends Pick<Course, 'id' | 'name' | 'updatedAt'>>(
	courses: readonly C[],
	lastSession: ReadonlyMap<CourseId, number>
): C[] {
	const used = (course: C): number => Math.max(course.updatedAt, lastSession.get(course.id) ?? 0);
	return [...courses].sort((a, b) => used(b) - used(a) || compareText(a.name, b.name));
}
