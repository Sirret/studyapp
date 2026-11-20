import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { KvRepo } from '#lib/db/repos/kv-repo.ts';
import { createDb } from '#lib/db/schema.ts';
import { DEFAULT_SETTINGS } from '#lib/db/schemas/kv.ts';
import { Logger } from '#lib/log/logger.ts';
import { SettingsService } from '#lib/services/settings-service.ts';

let db = createDb(`settings-${randomUUID()}`);
afterEach(async () => {
	await db.delete();
});

function setup(): { service: SettingsService; kv: KvRepo } {
	db = createDb(`settings-${randomUUID()}`);
	const kv = new KvRepo(db);
	const logger = new Logger({ sink: { append: async () => {} }, clock: () => 0 });
	return { service: new SettingsService({ kv, logger }), kv };
}

describe('SettingsService (DATA_MODEL §5)', () => {
	it('reads the defaults when nothing is stored', async () => {
		expect(await setup().service.get()).toStrictEqual(DEFAULT_SETTINGS);
	});

	it('saves one field and keeps the rest', async () => {
		const { service, kv } = setup();
		await service.update({ theme: 'dark' });
		await service.update({ sounds: false, spellingMode: 'firstLetter' });
		expect(await kv.get('settings')).toStrictEqual({
			...DEFAULT_SETTINGS,
			theme: 'dark',
			sounds: false,
			spellingMode: 'firstLetter'
		});
	});

	it('keeps fields the screen does not show (retention, music)', async () => {
		const { service, kv } = setup();
		await kv.set('settings', { ...DEFAULT_SETTINGS, retention: 0.85, music: true });
		const next = await service.update({ haptics: false });
		expect(next.retention).toBe(0.85);
		expect(next.music).toBe(true);
	});

	it('rejects a bad value and stores nothing', async () => {
		const { service, kv } = setup();
		await expect(service.update({ theme: 'neon' as never })).rejects.toThrow();
		expect(await kv.get('settings')).toBeUndefined();
	});
});
