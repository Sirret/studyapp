import { ContentStore } from '#lib/db/repos/content-store.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { KvRepo } from '#lib/db/repos/kv-repo.ts';
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

let sampleCheck: Promise<boolean> | null = null;

/**
 * First run: adds the built-in sample course once, when the student has no courses. Resolves to
 * `true` when this call added it, so the home page can reload its plan. Runs at most once per page
 * load (a second call gets the same promise). Never rejects: a failure is logged and tried again
 * on the next start.
 *
 * @see sample-course.ts
 */
export function ensureSampleCourse(): Promise<boolean> {
	sampleCheck ??= (async () => {
		try {
			const outcome = await seedSampleCourse({
				kv,
				courses: store.courses,
				importer: importService,
				loadText: async () => (await import('#lib/content/sample-course.ts')).SAMPLE_COURSE_REPLY
			});
			return outcome === 'added';
		} catch (error: unknown) {
			logger.error('sample', 'sample course not added', { error: String(error) });
			return false;
		}
	})();
	return sampleCheck;
}
