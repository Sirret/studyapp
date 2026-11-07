import { registerSW } from 'virtual:pwa-register';
import type { Logger } from '#lib/log/logger.ts';

/**
 * Registers the service worker and logs its lifecycle. A new version waits until the update prompt
 * (Phase 9) asks for it.
 *
 * @see BUILD_PLAN §8.3
 */
export function registerServiceWorker(logger: Logger): void {
	registerSW({
		onOfflineReady: () => logger.info('sw', 'app cached, ready offline'),
		onNeedRefresh: () => logger.info('sw', 'new version waiting'),
		onRegisterError: (error: unknown) =>
			logger.error('sw', 'registration failed', { error: String(error) })
	});
}
