import type { KvRepo } from '#lib/db/repos/kv-repo.ts';
import { DEFAULT_SETTINGS, SettingsSchema, type Settings } from '#lib/db/schemas/kv.ts';
import type { Logger } from '#lib/log/logger.ts';

/** The fields the Settings screen changes (Phase 8.6 step 10; music stays hidden until Phase 10). */
export type SettingsPatch = Partial<
	Pick<Settings, 'theme' | 'companion' | 'haptics' | 'sounds' | 'spellingMode'>
>;

export interface SettingsServiceDeps {
	kv: Pick<KvRepo, 'get' | 'set'>;
	logger: Logger;
}

/**
 * The stored settings (kv `settings`): read with the defaults when never saved, and changed one
 * field at a time, each change saved straight away.
 *
 * @see DATA_MODEL §5 (Settings)
 * @see DESIGN §12 row "Settings"
 */
export class SettingsService {
	constructor(private readonly deps: SettingsServiceDeps) {}

	/** The stored settings, or the defaults when none are stored yet. */
	async get(): Promise<Settings> {
		return (await this.deps.kv.get('settings')) ?? DEFAULT_SETTINGS;
	}

	/** Saves `patch` over the stored settings and returns the result. A bad value throws. */
	async update(patch: SettingsPatch): Promise<Settings> {
		const next = SettingsSchema.parse({ ...(await this.get()), ...patch });
		await this.deps.kv.set('settings', next);
		this.deps.logger.info('settings', 'updated', { fields: Object.keys(patch) });
		return next;
	}
}
