import type { SnowpackDb } from '../schema.ts';
import { KV_SCHEMAS, type KvKey, type KvValue } from '../schemas/kv.ts';

/**
 * Typed access to the `kv` singletons. Values are validated on every read and write, because this
 * is a boundary: a bad value throws, since it can only come from a bug or a damaged database.
 *
 * @see DATA_MODEL §5
 * @see BUILD_PLAN §15.3
 */
export class KvRepo {
	constructor(private readonly db: SnowpackDb) {}

	/** Reads a value, or `undefined` if it was never set. */
	async get<K extends KvKey>(key: K): Promise<KvValue<K> | undefined> {
		const row = await this.db.kv.get(key);
		return row === undefined ? undefined : (KV_SCHEMAS[key].parse(row.value) as KvValue<K>);
	}

	/** Writes a value. */
	async set<K extends KvKey>(key: K, value: KvValue<K>): Promise<void> {
		await this.db.kv.put({ key, value: KV_SCHEMAS[key].parse(value) });
	}
}
