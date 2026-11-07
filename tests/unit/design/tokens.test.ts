import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	COURSE_COLORS,
	COURSE_FILLS,
	contrastRatio,
	NON_TEXT_PAIRS,
	TEXT_PAIRS,
	THEME_COLORS,
	type ThemeName
} from '#lib/design/tokens.ts';

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;
const THEMES: ThemeName[] = ['light', 'dark'];

/** `--name: value;` declarations of a CSS file. */
function declarations(path: string): Map<string, string> {
	const css = readFileSync(path, 'utf8');
	return new Map(
		[...css.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [
			m[1] as string,
			(m[2] as string).trim()
		])
	);
}

const base = declarations('src/lib/design/tokens/base.css');
const themeFiles: Record<ThemeName, Map<string, string>> = {
	light: declarations('src/lib/design/themes/light.css'),
	dark: declarations('src/lib/design/themes/dark.css')
};

/** A theme token's value, resolving `var(--palette-…)` through the base tokens. */
function resolve(theme: ThemeName, token: string): string | undefined {
	const value = themeFiles[theme].get(token);
	const ref = value?.match(/^var\(--([\w-]+)\)$/)?.[1];
	return ref ? base.get(ref) : value;
}

describe('tokens.ts mirrors the theme files (DESIGN §3.1)', () => {
	it.each(THEMES)('%s: every mirrored colour matches its CSS value', (theme) => {
		for (const [token, hex] of Object.entries(THEME_COLORS[theme])) {
			expect(resolve(theme, token), `--${token}`).toBe(hex);
		}
		for (const color of COURSE_COLORS) {
			expect(resolve(theme, `course-${color}`), `--course-${color}`).toBe(
				COURSE_FILLS[theme][color]
			);
		}
	});

	it('both themes define the same tokens', () => {
		expect([...themeFiles.dark.keys()].sort()).toStrictEqual([...themeFiles.light.keys()].sort());
	});
});

describe('contrast (DESIGN §9)', () => {
	it.each(THEMES)('%s: text pairs reach 4.5:1', (theme) => {
		const colors = THEME_COLORS[theme];
		const failures = TEXT_PAIRS.filter(
			([fg, bg]) => contrastRatio(colors[fg], colors[bg]) < AA_TEXT
		);
		expect(failures).toStrictEqual([]);
	});

	it.each(THEMES)('%s: icons and focus rings reach 3:1', (theme) => {
		const colors = THEME_COLORS[theme];
		const failures = NON_TEXT_PAIRS.filter(
			([fg, bg]) => contrastRatio(colors[fg], colors[bg]) < AA_NON_TEXT
		);
		expect(failures).toStrictEqual([]);
	});

	it.each(THEMES)('%s: course names on course fills reach 4.5:1', (theme) => {
		const text = THEME_COLORS[theme]['on-course'];
		for (const color of COURSE_COLORS) {
			expect(contrastRatio(text, COURSE_FILLS[theme][color]), color).toBeGreaterThanOrEqual(
				AA_TEXT
			);
		}
	});

	it('computes the WCAG ratio', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
		expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
	});
});
