import { KvRepo } from '#lib/db/repos/kv-repo.ts';
import { DEFAULT_SETTINGS } from '#lib/db/schemas/kv.ts';
import { db } from './app.ts';
import type { DisplayPrefs } from './preferences.ts';

/**
 * Reads the display settings and the sleep window. Imported lazily by `loadPreferences`.
 *
 * @see DATA_MODEL §5
 */
export async function readDisplayPrefs(): Promise<{
	prefs: DisplayPrefs;
	sleepWindow: { start: string; end: string } | null;
}> {
	const kv = new KvRepo(db);
	const settings = (await kv.get('settings')) ?? DEFAULT_SETTINGS;
	const availability = await kv.get('availability');
	return {
		prefs: {
			theme: settings.theme,
			companion: settings.companion,
			companionName: settings.companionName,
			haptics: settings.haptics
		},
		sleepWindow: availability?.sleepWindow ?? null
	};
}
