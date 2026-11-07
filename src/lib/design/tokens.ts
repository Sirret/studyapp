/**
 * The theme colours as data, mirroring `themes/light.css` and `themes/dark.css` (a unit test
 * checks they agree). Used by the contrast test and by code that needs a colour outside CSS,
 * such as the browser's theme colour.
 *
 * @see DESIGN §3.1 and §9
 */

/** Semantic colour tokens that carry text, icons or focus rings. */
export type ColorToken =
	| 'bg'
	| 'surface'
	| 'surface-alt'
	| 'border'
	| 'text'
	| 'text-muted'
	| 'primary'
	| 'primary-soft'
	| 'on-primary'
	| 'accent'
	| 'on-accent'
	| 'success'
	| 'success-soft'
	| 'error'
	| 'error-soft'
	| 'warning'
	| 'warning-soft'
	| 'focus'
	| 'moon'
	| 'on-course';

export type ThemeName = 'light' | 'dark';

/** @see DESIGN §3.1 (light values darkened where the contrast test required it; hue kept) */
export const THEME_COLORS: Readonly<Record<ThemeName, Readonly<Record<ColorToken, string>>>> = {
	light: {
		bg: '#fbf7f0',
		surface: '#fffdf9',
		'surface-alt': '#f4eefa',
		border: '#e8e1d5',
		text: '#2b2540',
		'text-muted': '#69627f',
		primary: '#6453c6',
		'primary-soft': '#e9e4fb',
		'on-primary': '#ffffff',
		accent: '#f29e6d',
		'on-accent': '#2b2540',
		success: '#337653',
		'success-soft': '#e3f1e8',
		error: '#ab465c',
		'error-soft': '#fbe6ea',
		warning: '#8a6100',
		'warning-soft': '#fdf3d6',
		focus: '#6453c6',
		moon: '#f2c14e',
		'on-course': '#2b2540'
	},
	dark: {
		bg: '#1b1830',
		surface: '#26223f',
		'surface-alt': '#312b52',
		border: '#3a3460',
		text: '#f3efff',
		'text-muted': '#b7afd6',
		primary: '#a99bff',
		'primary-soft': '#3b3466',
		'on-primary': '#1b1830',
		accent: '#f5a97f',
		'on-accent': '#1b1830',
		success: '#7bcb9c',
		'success-soft': '#21402f',
		error: '#f08aa0',
		'error-soft': '#4a2433',
		warning: '#f2c14e',
		'warning-soft': '#4a3d17',
		focus: '#a99bff',
		moon: '#f2c14e',
		'on-course': '#1b1830'
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

/** Text on these backgrounds must reach 4.5:1 (WCAG AA). @see DESIGN §9 */
export const TEXT_PAIRS: readonly (readonly [ColorToken, ColorToken])[] = [
	...(['bg', 'surface', 'surface-alt'] as const).flatMap((background) =>
		(['text', 'text-muted', 'primary'] as const).map((fg) => [fg, background] as const)
	),
	['text', 'primary-soft'],
	['text-muted', 'primary-soft'],
	['primary', 'primary-soft'],
	['on-primary', 'primary'],
	['on-accent', 'accent'],
	['text', 'success-soft'],
	['success', 'success-soft'],
	['success', 'surface'],
	['text', 'error-soft'],
	['error', 'error-soft'],
	['error', 'surface'],
	['text', 'warning-soft'],
	['warning', 'warning-soft'],
	['warning', 'surface']
];

/** Icons and focus rings on these backgrounds must reach 3:1. @see DESIGN §9 */
export const NON_TEXT_PAIRS: readonly (readonly [ColorToken, ColorToken])[] = [
	['focus', 'bg'],
	['focus', 'surface'],
	['focus', 'surface-alt'],
	['primary', 'bg'],
	['success', 'success-soft'],
	['error', 'error-soft']
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
