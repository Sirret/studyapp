import type { Table } from 'dexie';
import type { z } from 'zod';
import type { DeviceId, Meta } from '../schemas/common.ts';

/** What every content repository needs from outside. Injected, so tests can pass fakes. */
export interface RepoContext {
	clock: () => number;
	newId: () => string;
	getDeviceId: () => Promise<DeviceId>;
}

/** The fields the repository owns, which callers never set. */
export type RepoManaged = 'id' | keyof Meta;

/**
 * Base of every content repository: typed reads that hide tombstones, and writes that set
 * `updatedAt` and `deviceId`, validate, and delete by tombstone. `F` is what callers may write;
 * `initial` supplies any fields callers may not, such as a new card's empty caches.
 *
 * @see CLAUDE.md rule 6
 * @see DATA_MODEL §2
 */
export class ContentRepo<T extends Meta & { id: string }, F> {
	constructor(
		protected readonly table: Table<T, string>,
		private readonly schema: z.ZodType<T>,
		protected readonly context: RepoContext,
		private readonly initial: () => Partial<T> = () => ({})
	) {}

	/** Builds a valid new record without storing it, for `ContentStore.writeBatch`. */
	draft(fields: F, deviceId: DeviceId): T {
		const now = this.context.clock();
		return this.schema.parse({
			...this.initial(),
			...fields,
			id: this.context.newId(),
			createdAt: now,
			updatedAt: now,
			deviceId
		});
	}

	/** Builds a valid changed record without storing it, for `ContentStore.writeBatch`. */
	draftChange(existing: T, patch: Partial<F>, deviceId: DeviceId): T {
		return this.schema.parse({
			...existing,
			...patch,
			updatedAt: this.context.clock(),
			deviceId
		});
	}

	/** Creates a record with a new ID. */
	async create(fields: F): Promise<T> {
		const record = this.draft(fields, await this.context.getDeviceId());
		await this.table.add(record);
		return record;
	}

	/** Returns a live record, or `undefined` if it is missing or deleted. */
	async get(id: string): Promise<T | undefined> {
		const record = await this.table.get(id);
		return record?.deleted ? undefined : record;
	}

	/** Returns every live record. */
	async list(): Promise<T[]> {
		return (await this.table.toArray()).filter((record) => !record.deleted);
	}

	/** Changes a live record, and returns it. Throws if there is no such record. */
	async update(id: string, patch: Partial<F>): Promise<T> {
		const deviceId = await this.context.getDeviceId();
		return this.table.db.transaction('rw', this.table, async () => {
			const existing = await this.get(id);
			if (!existing) throw new Error(`No live record ${id} in ${this.table.name}`);
			const record = this.draftChange(existing, patch, deviceId);
			await this.table.put(record);
			return record;
		});
	}

	/** Marks a record deleted, so the deletion can merge to other devices. */
	async softDelete(id: string): Promise<void> {
		const deviceId = await this.context.getDeviceId();
		await this.table.db.transaction('rw', this.table, async () => {
			const existing = await this.table.get(id);
			if (!existing) return;
			await this.table.put({
				...existing,
				deleted: true,
				updatedAt: this.context.clock(),
				deviceId
			});
		});
	}
}
