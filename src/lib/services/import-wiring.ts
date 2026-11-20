import { ContentStore } from '#lib/db/repos/content-store.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { KvRepo } from '#lib/db/repos/kv-repo.ts';
import type { CourseId } from '#lib/db/schemas/common.ts';
export { buildPrompt, GIVING_LABELS, PDF_TIP } from '#lib/import/prompt-v2.ts';
export type { Giving, Intake } from '#lib/import/prompt-v2.ts';
export { buildFixPrompt } from '#lib/import/fix-prompt.ts';
import { db, logger } from './app.ts';
import { ImportService } from './import-service.ts';
import { seedSampleCourse } from './sample-course.ts';
import { WebImageEncoder } from './web-image-encoder.ts';

const newId = () => crypto.randomUUID();
const device = new DeviceRepo(db, newId);
const store = new ContentStore(db, {
	clock: () => Date.now(),
	newId,
	getDeviceId: () => device.getDeviceId()
});

/**
 * The import screen's service. A separate module so zod and fflate stay out of the app shell.
 *
 * @see CLAUDE.md rule 9
 */
export const importService = new ImportService(store, new WebImageEncoder(), newId, logger);

const kv = new KvRepo(db);

let adding: Promise<CourseId | null> | null = null;

/**
 * Welcome's "Try a sample course": adds the built-in sample course when the student has no
 * courses. Resolves to its id, or `null` when nothing was added (courses already exist, or the
 * import failed, which is logged). A second tap while the first runs gets the same promise.
 *
 * @see sample-course.ts
 */
export function addSampleCourse(): Promise<CourseId | null> {
	adding ??= (async () => {
		try {
			const outcome = await seedSampleCourse({
				kv,
				courses: store.courses,
				importer: importService,
				loadText: async () => (await import('#lib/content/sample-course.ts')).SAMPLE_COURSE_REPLY
			});
			return outcome.kind === 'added' ? outcome.courseId : null;
		} catch (error: unknown) {
			logger.error('sample', 'sample course not added', { error: String(error) });
			return null;
		} finally {
			adding = null;
		}
	})();
	return adding;
}
