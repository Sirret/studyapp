import { KvRepo } from '#lib/db/repos/kv-repo.ts';
import { db, logger } from './app.ts';
import type { DisplayPrefs } from './preferences.ts';
import { SettingsService } from './settings-service.ts';

const kv = new KvRepo(db);

/** The Settings screen's service; lazy, so zod and the repositories stay out of the shell. */
export const settingsService = new SettingsService({ kv, logger });

/**
 * Reads the display settings and the sleep window. Imported lazily by `loadPreferences`.
 *
 * @see DATA_MODEL §5
 */
export async function readDisplayPrefs(): Promise<{
	prefs: DisplayPrefs;
	sleepWindow: { start: string; end: string } | null;
}> {
	const settings = await settingsService.get();
	const availability = await kv.get('availability');
	return {
		prefs: {
			theme: settings.theme,
			companion: settings.companion,
			companionName: settings.companionName,
			haptics: settings.haptics,
			sounds: settings.sounds
		},
		sleepWindow: availability?.sleepWindow ?? null
	};
}
