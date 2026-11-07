/**
 * Renders the PWA icons in `static/icons/` from the app-icon art in `docs/design/icons/`, and
 * copies the SVG favicon next to them. Run by hand with `npm run icons` when the art changes; the
 * outputs are committed.
 *
 * @see DESIGN §7.2
 */
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const SRC_DIR = 'docs/design/icons';
const OUT_DIR = 'static/icons';
const ICONS = [
	{ file: 'icon-192.png', size: 192, source: 'icon-full.svg' },
	{ file: 'icon-512.png', size: 512, source: 'icon-full.svg' },
	// Maskable icons may be cropped to a circle: that art keeps Yuki inside the central safe zone.
	{ file: 'icon-maskable-512.png', size: 512, source: 'icon-maskable.svg' }
];

mkdirSync(OUT_DIR, { recursive: true });
copyFileSync(`${SRC_DIR}/favicon.svg`, `${OUT_DIR}/favicon.svg`);

const browser = await chromium.launch();
for (const { file, size, source } of ICONS) {
	const svg = readFileSync(`${SRC_DIR}/${source}`, 'utf8');
	const page = await browser.newPage({ viewport: { width: size, height: size } });
	await page.setContent(`<!doctype html>
		<body style="margin:0;width:${size}px;height:${size}px;background:transparent">
			<div style="width:${size}px;height:${size}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
		</body>`);
	await page.screenshot({ path: `${OUT_DIR}/${file}`, omitBackground: true });
	await page.close();
}
await browser.close();
