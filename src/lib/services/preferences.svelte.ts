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
