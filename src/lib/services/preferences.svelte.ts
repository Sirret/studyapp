import { DEFAULT_DISPLAY_PREFS, type DisplayPrefs } from './preferences.ts';

export {
	resolveTheme,
	THEME_HINT_KEY,
	DEFAULT_DISPLAY_PREFS,
	type DisplayPrefs
} from './preferences.ts';

/** Live display preferences; screens and effects read these. */
export const prefs: DisplayPrefs = $state({ ...DEFAULT_DISPLAY_PREFS });

/** The stored sleep window, for auto-night; null until loaded or when unset. */
export const sleep: { window: { start: string; end: string } | null } = $state({ window: null });

/**
 * Loads the stored settings in the background. A separate module reads them, so zod and the
 * repositories stay out of the app shell.
 *
 * @see CLAUDE.md rule 9
 */
export async function loadPreferences(): Promise<void> {
	const { readDisplayPrefs } = await import('./preferences-wiring.ts');
	const stored = await readDisplayPrefs();
	Object.assign(prefs, stored.prefs);
	sleep.window = stored.sleepWindow;
}

/**
 * Saves a display setting from the Settings screen: the live `prefs` change at once (theme and
 * companion follow straight away) and the stored settings are updated.
 *
 * @see DESIGN §12 row "Settings"
 */
export async function savePreference(
	patch: Partial<Pick<DisplayPrefs, 'theme' | 'companion' | 'haptics' | 'sounds'>>
): Promise<void> {
	Object.assign(prefs, patch);
	const { settingsService } = await import('./preferences-wiring.ts');
	await settingsService.update(patch);
}
