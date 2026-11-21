import Dexie from 'dexie';
import { describe, expect, it, vi } from 'vitest';
import { Logger } from '#lib/log/logger.ts';
import {
	isQuotaError,
	OUT_OF_SPACE_MESSAGE,
	saveErrorMessage,
	StorageGuard
} from '#lib/services/storage-guard.ts';

function logger(): { logger: Logger; entries: unknown[] } {
	const entries: unknown[] = [];
	return {
		entries,
		logger: new Logger({
			sink: { append: async (entry) => void entries.push(entry) },
			clock: () => 1
		})
	};
}

describe('isQuotaError', () => {
	it('recognises the browser error and Dexie wrappers around it', () => {
		const native = new DOMException('full', 'QuotaExceededError');
		expect(isQuotaError(native)).toBe(true);
		expect(isQuotaError(new Dexie.QuotaExceededError('full'))).toBe(true);
		expect(isQuotaError(new Dexie.AbortError('aborted', native))).toBe(true);
		expect(isQuotaError(new Error('outer', { cause: native }))).toBe(true);
	});

	it('rejects other errors and non-errors', () => {
		expect(isQuotaError(new Error('disk full'))).toBe(false);
		expect(isQuotaError(new DOMException('x', 'AbortError'))).toBe(false);
		expect(isQuotaError('QuotaExceededError')).toBe(false);
		expect(isQuotaError(null)).toBe(false);
	});

	it('picks the out-of-space message only for a full quota', () => {
		expect(saveErrorMessage(new DOMException('', 'QuotaExceededError'), 'other')).toBe(
			OUT_OF_SPACE_MESSAGE
		);
		expect(saveErrorMessage(new Error('x'), 'other')).toBe('other');
	});
});

describe('StorageGuard', () => {
	it('asks once per run, even when called concurrently', async () => {
		const storage = { persisted: vi.fn(async () => false), persist: vi.fn(async () => true) };
		const guard = new StorageGuard(storage, logger().logger);
		const results = await Promise.all([guard.ensurePersisted(), guard.ensurePersisted()]);
		await guard.ensurePersisted();
		expect(results).toEqual([true, true]);
		expect(storage.persist).toHaveBeenCalledTimes(1);
	});

	it('does not ask when the data is already persistent', async () => {
		const storage = { persisted: vi.fn(async () => true), persist: vi.fn(async () => true) };
		expect(await new StorageGuard(storage, logger().logger).ensurePersisted()).toBe(true);
		expect(storage.persist).not.toHaveBeenCalled();
	});

	it('logs a refusal and never throws', async () => {
		const { logger: log, entries } = logger();
		const refused = { persisted: async () => false, persist: async () => false };
		expect(await new StorageGuard(refused, log).ensurePersisted()).toBe(false);
		const broken = {
			persisted: async () => false,
			persist: async (): Promise<boolean> => {
				throw new Error('blocked');
			}
		};
		expect(await new StorageGuard(broken, log).ensurePersisted()).toBe(false);
		await vi.waitFor(() => expect(entries).toHaveLength(2));
	});

	it('works without the storage API', async () => {
		expect(await new StorageGuard(undefined, logger().logger).ensurePersisted()).toBe(false);
	});
});
