import { ContentStore } from '#lib/db/repos/content-store.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { CHATBOT_PROMPT } from '#lib/import/prompt.ts';
import { db, logger } from './app.ts';
import { ImportService } from './import-service.ts';
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

export { CHATBOT_PROMPT };
