import { dev } from '$app/env';
import { createDb } from '#lib/db/schema.ts';
import { LogRepo } from '#lib/db/repos/log-repo.ts';
import { installErrorCapture } from '#lib/log/error-capture.ts';
import { Logger } from '#lib/log/logger.ts';
import { registerServiceWorker } from '#lib/pwa/register-sw.ts';

/** The app's database. Only other service wiring uses this; screens go through services. */
export const db = createDb();

/** The app-wide logger. */
export const logger = new Logger({
	sink: new LogRepo(db),
	clock: () => Date.now(),
	console: dev ? console : undefined
});

/**
 * Starts the app's long-lived services: error capture first, so failures below it are logged.
 *
 * @see BUILD_PLAN §11.5 and §8.3
 */
export function startApp(): void {
	installErrorCapture(window, logger);
	logger.info('app', 'started', { dev });
	registerServiceWorker(logger);
}
