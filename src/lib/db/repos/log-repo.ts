import { LOG_RING_SIZE } from '#lib/config/defaults.ts';
import type { SnowpackDb } from '../schema';
import type { LogEntry, NewLogEntry } from '../schemas/log-entry';

/**
 * Repository for the `logs` table: an IndexedDB ring buffer of the newest entries.
 *
 * @see BUILD_PLAN §11.5
 * @see DATA_MODEL §6
 */
export class LogRepo {
	constructor(
		private readonly db: SnowpackDb,
		private readonly ringSize: number = LOG_RING_SIZE
	) {}

	/** Stores one entry and drops the oldest entries beyond the ring size. */
	async append(_entry: NewLogEntry): Promise<void> {
		void this.db;
		void this.ringSize;
		throw new Error('not implemented');
	}

	/** Returns every stored entry, oldest first. */
	async list(): Promise<LogEntry[]> {
		throw new Error('not implemented');
	}
}
