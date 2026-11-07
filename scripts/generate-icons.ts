/**
 * Renders the PWA icons in `static/icons/` from Yuki's reference art. Run by hand with
 * `npm run icons` when the art changes; the PNGs are committed.
 *
 * @see DESIGN §7.2
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { PWA_BACKGROUND_COLOR } from '../src/lib/config/defaults.ts';

const OUT_DIR = 'static/icons';
const ICONS = [
	{ file: 'icon-192.png', size: 192, artShare: 0.86 },
	{ file: 'icon-512.png', size: 512, artShare: 0.86 },
	// Maskable icons may be cropped to a circle: keep the art inside the central safe zone.
	{ file: 'icon-maskable-512.png', size: 512, artShare: 0.64 }
];

const svg = readFileSync('docs/design/wolf.svg', 'utf8');
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
for (const { file, size, artShare } of ICONS) {
	const page = await browser.newPage({ viewport: { width: size, height: size } });
	const art = Math.round(size * artShare);
	await page.setContent(`<!doctype html>
		<body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px;background:${PWA_BACKGROUND_COLOR}">
			<div style="width:${art}px;height:${art}px">${svg.replace('width="200" height="200"', 'width="100%" height="100%"')}</div>
		</body>`);
	await page.screenshot({ path: `${OUT_DIR}/${file}` });
	await page.close();
}
await browser.close();
