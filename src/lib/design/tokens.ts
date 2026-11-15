/**
 * The theme colours as data, mirroring `themes/light.css` and `themes/lamp.css` (a unit test
 * checks they agree). Used by the contrast test and by code that needs a colour outside CSS,
 * such as the browser's theme colour. The lamp-light theme's key is `dark`, the stored value of
 * the theme setting (Decisions log "Design reskin: theme setting").
 *
 * @see DESIGN §3, §4 and §11
 */

/** Semantic colour tokens (DESIGN §4), plus the course-name colour. */
export type ColorToken =
	| 'bg'
	| 'bg-deep'
	| 'surface'
	| 'surface-sunk'
	| 'surface-tag'
	| 'text'
	| 'text-strong'
	| 'text-soft'
	| 'decor'
	| 'line'
	| 'line-strong'
	| 'outline'
	| 'btn-primary-bg'
	| 'btn-primary-fg'
	| 'btn-primary-lip'
	| 'accent'
	| 'on-accent'
	| 'mode-learn'
	| 'mode-practice'
	| 'mode-exam'
	| 'mode-play'
	| 'rim'
	| 'correct'
	| 'wrong'
	| 'keyterm'
	| 'on-dark-fill'
	| 'on-light-fill'
	| 'glow'
	| 'on-course';

export type ThemeName = 'light' | 'dark';

/** @see DESIGN §3.1 (light "cabin") and §3.2 (lamp-light) */
export const THEME_COLORS: Readonly<Record<ThemeName, Readonly<Record<ColorToken, string>>>> = {
	light: {
		bg: '#efe4d0',
		'bg-deep': '#efe4d0',
		surface: '#f3eadb',
		'surface-sunk': '#e6d8be',
		'surface-tag': '#ead7b5',
		text: '#1d2230',
		'text-strong': '#1d2230',
		'text-soft': '#4a4238',
		decor: '#9c8b72',
		line: '#d8c6a6',
		'line-strong': '#c9ae86',
		outline: '#1d2230',
		'btn-primary-bg': '#1d2230',
		'btn-primary-fg': '#f3eadb',
		'btn-primary-lip': '#7a2621',
		accent: '#7a2621',
		'on-accent': '#f3eadb',
		'mode-learn': '#2e4a3b',
		'mode-practice': '#1c2740',
		'mode-exam': '#7a2621',
		'mode-play': '#d4b26a',
		rim: '#d4b26a',
		correct: '#2e4a3b',
		wrong: '#7a2621',
		keyterm: '#c79e6e',
		'on-dark-fill': '#efe3cc',
		'on-light-fill': '#1d2230',
		glow: '#e0913a',
		'on-course': '#1d2230'
	},
	dark: {
		bg: '#231c16',
		'bg-deep': '#14100c',
		surface: '#2c241c',
		'surface-sunk': '#14100c',
		'surface-tag': '#2c241c',
		text: '#e3d5bc',
		'text-strong': '#efe3cc',
		'text-soft': '#b8a68a',
		decor: '#7d6b55',
		line: '#4a3d30',
		'line-strong': '#4a3d30',
		outline: '#e3d5bc',
		'btn-primary-bg': '#e3d5bc',
		'btn-primary-fg': '#231c16',
		'btn-primary-lip': '#8a3a2e',
		accent: '#d98c70',
		'on-accent': '#231c16',
		'mode-learn': '#2a4034',
		'mode-practice': '#14100c',
		'mode-exam': '#8a3a2e',
		'mode-play': '#b8964f',
		rim: '#b8964f',
		correct: '#9cc7a6',
		wrong: '#d98c70',
		keyterm: '#8a6a45',
		'on-dark-fill': '#efe3cc',
		'on-light-fill': '#231c16',
		glow: '#e3a35c',
		'on-course': '#231c16'
	}
};

/** Course colour names, in the order new courses get them (DESIGN §3.1). */
export const COURSE_COLORS = ['lavender', 'peach', 'sage', 'sky', 'rose', 'butter'] as const;
export type CourseColor = (typeof COURSE_COLORS)[number];

/** Course fills per theme, for the contrast test. */
export const COURSE_FILLS: Readonly<Record<ThemeName, Readonly<Record<CourseColor, string>>>> = {
	light: {
		lavender: '#b9a9f5',
		peach: '#f7be9b',
		sage: '#a9d3b5',
		sky: '#a8cbef',
		rose: '#f2b3c2',
		butter: '#f3dc92'
	},
	dark: {
		lavender: '#8f7fe0',
		peach: '#e59a6e',
		sage: '#6faf83',
		sky: '#6e9fd6',
		rose: '#d8849a',
		butter: '#cdb050'
	}
};

/** Text on these backgrounds must reach 4.5:1 (WCAG AA). `decor` is never text. @see DESIGN §11 */
export const TEXT_PAIRS: readonly (readonly [ColorToken, ColorToken])[] = [
	...(['bg', 'bg-deep', 'surface', 'surface-sunk', 'surface-tag'] as const).flatMap((background) =>
		(['text', 'text-strong', 'text-soft', 'accent', 'correct', 'wrong'] as const).map(
			(fg) => [fg, background] as const
		)
	),
	['btn-primary-fg', 'btn-primary-bg'],
	['on-accent', 'accent'],
	// ModeDoor labels follow the fill (DESIGN §7)
	['on-dark-fill', 'mode-learn'],
	['on-dark-fill', 'mode-practice'],
	['on-dark-fill', 'mode-exam'],
	['on-light-fill', 'mode-play']
];

/** Outlines of pressables, focus rings and the button lip must reach 3:1. @see DESIGN §6, §11 */
export const NON_TEXT_PAIRS: readonly (readonly [ColorToken, ColorToken])[] = [
	...(['bg', 'surface', 'surface-sunk', 'surface-tag'] as const).flatMap((background) =>
		(['outline', 'accent'] as const).map((fg) => [fg, background] as const)
	),
	['btn-primary-bg', 'bg']
];

/** WCAG relative luminance of a `#rrggbb` colour. */
export function luminance(hex: string): number {
	const channel = (offset: number): number => {
		const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
		return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two `#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
	return (light + 0.05) / (dark + 0.05);
}
