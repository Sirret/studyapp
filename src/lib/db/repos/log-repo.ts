import { LOG_RING_SIZE } from '#lib/config/defaults.ts';
import type { SnowpackDb } from '../schema.ts';
import type { LogEntry, NewLogEntry } from '../schemas/log-entry.ts';

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
	async append(entry: NewLogEntry): Promise<void> {
		const { logs } = this.db;
		await this.db.transaction('rw', logs, async () => {
			await logs.add(entry);
			const excess = (await logs.count()) - this.ringSize;
			if (excess > 0) await logs.orderBy('seq').limit(excess).delete();
		});
	}

	/** Returns every stored entry, oldest first. */
	async list(): Promise<LogEntry[]> {
		return this.db.logs.orderBy('seq').toArray();
	}
}
