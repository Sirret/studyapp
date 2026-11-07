import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { LogRepo } from '#lib/db/repos/log-repo.ts';
import { createDb, type SnowpackDb } from '#lib/db/schema.ts';
import type { NewLogEntry } from '#lib/db/schemas/log-entry.ts';

const entry = (message: string): NewLogEntry => ({ ts: 1, level: 'info', area: 'test', message });

describe('LogRepo', () => {
	let db: SnowpackDb;
	let dbCount = 0;

	function open(): SnowpackDb {
		dbCount += 1;
		db = createDb(`log-repo-test-${dbCount}`);
		return db;
	}

	afterEach(async () => {
		await db.delete();
	});

	it('creates every table from BUILD_PLAN §3.1', async () => {
		const database = open();
		await database.open();
		expect(database.tables.map((table) => table.name).sort()).toEqual(
			[
				'cards',
				'chunks',
				'courses',
				'events',
				'kv',
				'logs',
				'media',
				'notes',
				'sessions',
				'topics'
			].sort()
		);
	});

	it('returns entries oldest first with an assigned seq', async () => {
		const repo = new LogRepo(open());
		await repo.append(entry('first'));
		await repo.append(entry('second'));

		const logs = await repo.list();
		expect(logs.map((log) => log.message)).toEqual(['first', 'second']);
		expect(logs[0]?.seq).toBeLessThan(logs[1]?.seq ?? 0);
	});

	it('keeps only the newest entries once the ring is full', async () => {
		const repo = new LogRepo(open(), 3);
		for (const message of ['a', 'b', 'c', 'd', 'e']) await repo.append(entry(message));

		expect((await repo.list()).map((log) => log.message)).toEqual(['c', 'd', 'e']);
	});
});
