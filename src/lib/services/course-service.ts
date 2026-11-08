import type { ContentStore } from '#lib/db/repos/content-store.ts';
import type { CourseId } from '#lib/db/schemas/common.ts';
import type { Logger } from '#lib/log/logger.ts';

/**
 * Course housekeeping for screens: trashing a course and everything in it.
 *
 * @see Decisions log (trash a course)
 */
export class CourseService {
	constructor(
		private readonly store: ContentStore,
		private readonly logger: Logger
	) {}

	/** Trashes the course, its topics, chunks, notes and cards (soft delete, one transaction). */
	async trash(courseId: CourseId): Promise<void> {
		await this.store.trashCourse(courseId);
		this.logger.info('course', 'trashed', { courseId });
	}
}
