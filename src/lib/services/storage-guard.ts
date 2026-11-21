import type { Logger } from '#lib/log/logger.ts';

/** Shown when a save fails because the browser's storage quota is full. */
export const OUT_OF_SPACE_MESSAGE =
	'Your device is out of space for images. Delete unused courses or images and try again.';

/** The part of `navigator.storage` the guard uses; absent in old browsers and in tests. */
export type PersistApi = Pick<StorageManager, 'persist' | 'persisted'>;

/**
 * True when `error` is a full storage quota: the browser's `QuotaExceededError`, or Dexie's
 * wrapper around it (same name, or the original as `inner`).
 *
 * @see BUILD_PLAN §4.2
 */
export function isQuotaError(error: unknown): boolean {
	if (typeof error !== 'object' || error === null) return false;
	const { name, inner, cause } = error as { name?: unknown; inner?: unknown; cause?: unknown };
	return name === 'QuotaExceededError' || isQuotaError(inner) || isQuotaError(cause);
}

/** The message a failed save shows: the out-of-space message for a full quota, else `fallback`. */
export function saveErrorMessage(error: unknown, fallback: string): string {
	return isQuotaError(error) ? OUT_OF_SPACE_MESSAGE : fallback;
}

/**
 * Asks the browser once per app run to keep this site's data (images are the bulk of it), the
 * first time images are saved. Never blocks a save: a refusal or a missing API is only logged.
 *
 * @see BUILD_PLAN §4.2; WIP step 5
 */
export class StorageGuard {
	private asked: Promise<boolean> | null = null;

	constructor(
		private readonly storage: PersistApi | undefined,
		private readonly logger: Logger
	) {}

	/** Requests persistent storage once; resolves to whether the site's data is persistent. */
	ensurePersisted(): Promise<boolean> {
		this.asked ??= this.request();
		return this.asked;
	}

	private async request(): Promise<boolean> {
		if (!this.storage) return false;
		try {
			if (await this.storage.persisted()) return true;
			const granted = await this.storage.persist();
			this.logger.info('storage', 'persistent storage requested', { granted });
			return granted;
		} catch (error) {
			this.logger.warn('storage', 'persistent storage request failed', { error: String(error) });
			return false;
		}
	}
}
