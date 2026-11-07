import { describe, expect, it } from 'vitest';
import { AUTO_NIGHT_LEAD_HOURS } from '#lib/config/defaults.ts';
import { DEFAULT_SETTINGS } from '#lib/db/schemas/kv.ts';
import { DEFAULT_DISPLAY_PREFS, resolveTheme } from '#lib/services/preferences.ts';

const at = (hours: number, minutes = 0) => hours * 60 + minutes;
const SLEEP = { start: '23:00', end: '07:00' };

describe('DEFAULT_DISPLAY_PREFS', () => {
	it('matches the stored settings defaults (DATA_MODEL §5)', () => {
		const { theme, companion, companionName, haptics } = DEFAULT_SETTINGS;
		expect(DEFAULT_DISPLAY_PREFS).toStrictEqual({ theme, companion, companionName, haptics });
	});
});

describe('resolveTheme (DESIGN §3.1)', () => {
	const day = { systemDark: false, minuteOfDay: at(12), sleepWindow: SLEEP };

	it('light and dark are fixed', () => {
		expect(resolveTheme('light', { ...day, systemDark: true })).toBe('light');
		expect(resolveTheme('dark', day)).toBe('dark');
	});

	it('system follows the device', () => {
		expect(resolveTheme('system', day)).toBe('light');
		expect(resolveTheme('system', { ...day, systemDark: true })).toBe('dark');
	});

	it(`auto-night turns dark ${AUTO_NIGHT_LEAD_HOURS} hours before the sleep window and stays until it ends`, () => {
		const lead = at(23 - AUTO_NIGHT_LEAD_HOURS);
		expect(resolveTheme('auto-night', { ...day, minuteOfDay: lead - 1 })).toBe('light');
		expect(resolveTheme('auto-night', { ...day, minuteOfDay: lead })).toBe('dark');
		expect(resolveTheme('auto-night', { ...day, minuteOfDay: at(3) })).toBe('dark');
		expect(resolveTheme('auto-night', { ...day, minuteOfDay: at(7) })).toBe('light');
	});

	it('auto-night handles a window that starts after midnight', () => {
		const late = { ...day, sleepWindow: { start: '01:00', end: '08:00' } };
		expect(resolveTheme('auto-night', { ...late, minuteOfDay: at(23, 30) })).toBe('dark');
		expect(resolveTheme('auto-night', { ...late, minuteOfDay: at(22, 59) })).toBe('light');
	});

	it('auto-night without a sleep window follows the device', () => {
		expect(resolveTheme('auto-night', { ...day, sleepWindow: null, systemDark: true })).toBe(
			'dark'
		);
	});
});
