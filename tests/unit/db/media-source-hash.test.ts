import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MediaRepo } from '#lib/db/repos/content-repos.ts';
import type { RepoContext } from '#lib/db/repos/content-repo.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { createDb, type SnowpackDb } from '#lib/db/schema.ts';
import { MediaSchema } from '#lib/db/schemas/course.ts';
import type { DeviceId } from '#lib/db/schemas/common.ts';

/**
 * `media.sourceHash` (SHA-256 of the original file bytes) and its Dexie index (version 3). Images
 * stored before Phase 6 have no `sourceHash` and are still read and found by `hash`.
 *
 * @see DATA_MODEL §3.8; BUILD_PLAN §4.2; Decisions log "Phase 6 Q10–Q13" and "Phase 6 step 2"
 */

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const SOURCE_1 = '1'.repeat(64);
const SOURCE_2 = '2'.repeat(64);
const DEVICE_ID = randomUUID() as DeviceId;

/** Version 2 stores (no `sourceHash` index), as written by the app before Phase 6. */
const V2_STORES = {
	courses: 'id, status, examDate, updatedAt',
	topics: 'id, courseId, [courseId+order], updatedAt',
	chunks: 'id, topicId, [topicId+order], updatedAt',
	notes: 'id, courseId, topicId, chunkId, type, updatedAt',
	cards: 'id, noteId, courseId, status, due, updatedAt',
	events: 'id, ts, cardId, sessionId, type, [cardId+ts]',
	media: 'id, hash',
	sessions: 'id, startedAt, mode',
	kv: 'key',
	logs: '++seq, ts, level, area'
};

/** A complete media record (Meta and every required field), as the repo would store it. */
function mediaRecord(overrides: Record<string, unknown> = {}) {
	return {
		id: randomUUID(),
		hash: HASH_A,
		mime: 'image/webp',
		width: 640,
		height: 480,
		bytes: 1234,
		blob: new Blob(['pixels']),
		createdAt: 1_000,
		updatedAt: 1_000,
		deviceId: DEVICE_ID,
		...overrides
	};
}

describe('MediaSchema: sourceHash and mime', () => {
	it('accepts a record with a 64-character hex sourceHash', () => {
		expect(MediaSchema.safeParse(mediaRecord({ sourceHash: SOURCE_1 })).success).toBe(true);
	});

	it('accepts a record without sourceHash (images stored before Phase 6)', () => {
		const parsed = MediaSchema.safeParse(mediaRecord());
		expect(parsed.success).toBe(true);
		if (parsed.success) expect(parsed.data.sourceHash).toBeUndefined();
	});

	it.each(['', 'abc', '1'.repeat(63), '1'.repeat(65), 'g'.repeat(64)])(
		'rejects a sourceHash that is not 64 hex characters (%j)',
		(sourceHash) => {
			expect(MediaSchema.safeParse(mediaRecord({ sourceHash })).success).toBe(false);
		}
	);

	it.each(['image/webp', 'image/jpeg'])('accepts mime %s', (mime) => {
		expect(MediaSchema.safeParse(mediaRecord({ mime })).success).toBe(true);
	});

	it.each(['image/png', 'image/gif', 'image/bmp'])(
		'rejects mime %s (stored images are WebP or JPEG)',
		(mime) => {
			expect(MediaSchema.safeParse(mediaRecord({ mime })).success).toBe(false);
		}
	);
});

describe('MediaRepo.findBySourceHash', () => {
	let db: SnowpackDb;
	let media: MediaRepo;
	let dbName = '';

	beforeEach(() => {
		dbName = `media-source-hash-${randomUUID()}`;
		db = createDb(dbName);
		const device = new DeviceRepo(db, randomUUID);
		const context: RepoContext = {
			clock: () => 1_000,
			newId: randomUUID,
			getDeviceId: () => device.getDeviceId()
		};
		media = new MediaRepo(db, context);
	});

	afterEach(async () => {
		db.close();
		await Dexie.delete(dbName);
	});

	const image = (fields: { hash?: string; sourceHash?: string } = {}) =>
		media.create({
			hash: fields.hash ?? HASH_A,
			sourceHash: fields.sourceHash,
			mime: 'image/webp',
			width: 640,
			height: 480,
			bytes: 1234,
			blob: new Blob(['pixels'])
		});

	it('creates an image with its sourceHash and finds it by that hash', async () => {
		const created = await image({ sourceHash: SOURCE_1 });
		expect(created.sourceHash).toBe(SOURCE_1);
		expect((await media.findBySourceHash(SOURCE_1))?.id).toBe(created.id);
	});

	it('returns undefined when no live image has that sourceHash', async () => {
		await image({ sourceHash: SOURCE_1 });
		expect(await media.findBySourceHash(SOURCE_2)).toBeUndefined();
	});

	it('returns undefined on an empty table', async () => {
		expect(await media.findBySourceHash(SOURCE_1)).toBeUndefined();
	});

	it('finds the stored image by its original-file hash even when its stored hash differs', async () => {
		// Re-encoding can differ between browsers: same original bytes, different stored bytes.
		const created = await image({ hash: HASH_A, sourceHash: SOURCE_1 });
		const found = await media.findBySourceHash(SOURCE_1);
		expect(found?.id).toBe(created.id);
		expect(found?.hash).toBe(HASH_A);
	});

	it('does not match on the stored hash', async () => {
		await image({ hash: HASH_B, sourceHash: SOURCE_1 });
		expect(await media.findBySourceHash(HASH_B)).toBeUndefined();
	});

	it('ignores a tombstoned image', async () => {
		const created = await image({ sourceHash: SOURCE_1 });
		await media.softDelete(created.id);
		expect(await media.findBySourceHash(SOURCE_1)).toBeUndefined();
	});

	it('returns the live image when a tombstoned one shares the sourceHash', async () => {
		const old = await image({ hash: HASH_A, sourceHash: SOURCE_1 });
		await media.softDelete(old.id);
		const live = await image({ hash: HASH_B, sourceHash: SOURCE_1 });
		expect((await media.findBySourceHash(SOURCE_1))?.id).toBe(live.id);
	});

	it('does not find an image stored without a sourceHash', async () => {
		await image();
		expect(await media.findBySourceHash(SOURCE_1)).toBeUndefined();
	});

	it('keeps findByHash working for an image that has a sourceHash', async () => {
		const created = await image({ hash: HASH_A, sourceHash: SOURCE_1 });
		expect((await media.findByHash(HASH_A))?.id).toBe(created.id);
	});

	it('keeps findByHash working for an image stored without a sourceHash', async () => {
		const created = await image({ hash: HASH_B });
		expect((await media.findByHash(HASH_B))?.id).toBe(created.id);
	});
});

describe('Dexie version 3 over a version 2 database', () => {
	let opened: SnowpackDb | undefined;
	let dbName = '';

	beforeEach(() => {
		dbName = `media-v3-${randomUUID()}`;
	});

	afterEach(async () => {
		opened?.close();
		opened = undefined;
		await Dexie.delete(dbName);
	});

	/** Writes one legacy image (no `sourceHash`) with a version-2 database, then closes it. */
	async function writeLegacyImage(record: ReturnType<typeof mediaRecord>): Promise<void> {
		const v2 = new Dexie(dbName);
		v2.version(2).stores(V2_STORES);
		await v2.table('media').add(record);
		v2.close();
	}

	it('opens at version 3 with the sourceHash index', async () => {
		opened = createDb(dbName);
		await opened.open();
		expect(opened.verno).toBe(3);
		const indexes = opened.media.schema.indexes.map((index) => index.name);
		expect(indexes).toContain('sourceHash');
		expect(indexes).toContain('hash');
	});

	it('keeps an old image readable under MediaSchema, with sourceHash absent', async () => {
		const legacy = mediaRecord({ hash: HASH_A });
		await writeLegacyImage(legacy);
		opened = createDb(dbName);
		const row = await opened.media.get(legacy.id);
		expect(row).toBeDefined();
		const parsed = MediaSchema.parse(row);
		expect(parsed.sourceHash).toBeUndefined();
		expect(parsed.hash).toBe(HASH_A);
		expect(parsed.mime).toBe('image/webp');
		expect(parsed.width).toBe(640);
	});

	it('does not add a sourceHash to an old image during the upgrade', async () => {
		const legacy = mediaRecord();
		await writeLegacyImage(legacy);
		opened = createDb(dbName);
		const row = await opened.media.get(legacy.id);
		expect(row && 'sourceHash' in row).toBe(false);
	});

	it('still finds an old image by hash after the upgrade', async () => {
		const legacy = mediaRecord({ hash: HASH_B });
		await writeLegacyImage(legacy);
		opened = createDb(dbName);
		const media = new MediaRepo(opened, {
			clock: () => 1_000,
			newId: randomUUID,
			getDeviceId: async () => DEVICE_ID
		});
		expect((await media.findByHash(HASH_B))?.id).toBe(legacy.id);
	});

	it('finds no old image by sourceHash, and does not throw', async () => {
		const legacy = mediaRecord({ hash: HASH_B });
		await writeLegacyImage(legacy);
		opened = createDb(dbName);
		const media = new MediaRepo(opened, {
			clock: () => 1_000,
			newId: randomUUID,
			getDeviceId: async () => DEVICE_ID
		});
		expect(await media.findBySourceHash(SOURCE_1)).toBeUndefined();
	});

	it('finds an image stored after the upgrade by its sourceHash, next to an old one', async () => {
		const legacy = mediaRecord({ hash: HASH_B });
		await writeLegacyImage(legacy);
		opened = createDb(dbName);
		const media = new MediaRepo(opened, {
			clock: () => 1_000,
			newId: randomUUID,
			getDeviceId: async () => DEVICE_ID
		});
		const fresh = await media.create({
			hash: HASH_A,
			sourceHash: SOURCE_2,
			mime: 'image/jpeg',
			width: 800,
			height: 600,
			bytes: 99,
			blob: new Blob(['jpeg'])
		});
		expect((await media.findBySourceHash(SOURCE_2))?.id).toBe(fresh.id);
		expect((await media.findByHash(HASH_B))?.id).toBe(legacy.id);
	});
});
