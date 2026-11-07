import { AUTO_NIGHT_LEAD_HOURS } from '#lib/config/defaults.ts';

/** The settings every screen's look depends on. @see DATA_MODEL §5 (Settings) */
export interface DisplayPrefs {
	theme: 'system' | 'light' | 'dark' | 'auto-night';
	companion: 'full' | 'quiet' | 'off';
	companionName: string;
	haptics: boolean;
}

/** Until the stored settings load; matches `DEFAULT_SETTINGS` (a unit test checks). */
export const DEFAULT_DISPLAY_PREFS: DisplayPrefs = {
	theme: 'system',
	companion: 'full',
	companionName: 'Yuki',
	haptics: true
};

/** Where the resolved theme is remembered on this device, so the next start doesn't flash. */
export const THEME_HINT_KEY = 'snowpack.theme';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

function minutesOf(time: string): number {
	const [hours = 0, minutes = 0] = time.split(':').map(Number);
	return hours * MINUTES_PER_HOUR + minutes;
}

/**
 * The theme to show. `auto-night` is dark from `AUTO_NIGHT_LEAD_HOURS` before the sleep window
 * starts until it ends, or follows the system when there is no sleep window.
 *
 * @see DESIGN §3.1 (theme setting)
 */
export function resolveTheme(
	theme: DisplayPrefs['theme'],
	context: {
		systemDark: boolean;
		minuteOfDay: number;
		sleepWindow: { start: string; end: string } | null;
	}
): 'light' | 'dark' {
	if (theme === 'light' || theme === 'dark') return theme;
	if (theme === 'system' || context.sleepWindow === null)
		return context.systemDark ? 'dark' : 'light';
	const darkFrom = minutesOf(context.sleepWindow.start) - AUTO_NIGHT_LEAD_HOURS * MINUTES_PER_HOUR;
	const from = (darkFrom + MINUTES_PER_DAY) % MINUTES_PER_DAY;
	const to = minutesOf(context.sleepWindow.end);
	const now = context.minuteOfDay;
	const inside = from <= to ? now >= from && now < to : now >= from || now < to;
	return inside ? 'dark' : 'light';
}
