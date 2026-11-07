import type { DeviceId } from '../schemas/common.ts';
import { DeviceIdSchema } from '../schemas/common.ts';
import { KvRepo } from './kv-repo.ts';
import type { SnowpackDb } from '../schema.ts';

const FIRST_SEQ = 1;

/**
 * This device's identity and event sequence counter, both kept in `kv`.
 *
 * @see DATA_MODEL §5
 * @see BUILD_PLAN §6.12
 */
export class DeviceRepo {
	private cachedId: DeviceId | undefined;
	private readonly kv: KvRepo;

	constructor(
		private readonly db: SnowpackDb,
		private readonly newId: () => string
	) {
		this.kv = new KvRepo(db);
	}

	/** Returns this device's ID, creating it on first launch. */
	async getDeviceId(): Promise<DeviceId> {
		this.cachedId ??= await this.db.transaction('rw', this.db.kv, async () => {
			const existing = await this.kv.get('deviceId');
			if (existing) return existing;
			const created = DeviceIdSchema.parse(this.newId());
			await this.kv.set('deviceId', created);
			return created;
		});
		return this.cachedId;
	}

	/** Hands out the next sequence number. Strictly increasing, and durable across restarts. */
	async nextSeq(): Promise<number> {
		return this.db.transaction('rw', this.db.kv, async () => {
			const seq = (await this.kv.get('seq')) ?? FIRST_SEQ;
			await this.kv.set('seq', seq + 1);
			return seq;
		});
	}
}
