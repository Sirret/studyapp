/**
 * Phase 6 step 1 spike (not part of verify): pdf.js in Chromium, CPU throttled 4× (phone class).
 * Renders slide pages to a canvas sized like an imported image (long side IMAGE_MAX_PX 2000),
 * re-encodes to WebP, and times it; lists any network request made after pdf.js loaded.
 *
 * Usage: node scripts/spike/pdf-render.ts [path/to/slides.pdf]
 *
 * @see docs/WIP.md step 1, docs/spikes/PDF_SPIKE.md
 */
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const PDF = process.argv[2] ?? 'tests/fixtures/spike/slides.pdf';
const ORIGIN = 'http://spike.local';
const LONG_SIDE = 2000;
const PAGES = [3, 10, 21, 27, 38];
const THROTTLE = 4;

const FILES: Record<string, { path: string; type: string }> = {
	'/pdf.min.mjs': { path: 'node_modules/pdfjs-dist/build/pdf.min.mjs', type: 'text/javascript' },
	'/pdf.worker.min.mjs': {
		path: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
		type: 'text/javascript'
	},
	'/slides.pdf': { path: PDF, type: 'application/pdf' }
};

const PAGE = `<!doctype html><meta charset="utf-8"><script type="module">
window.run = async (pages, longSide) => {
	const t0 = performance.now();
	const pdfjs = await import('/pdf.min.mjs');
	pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
	const bytes = new Uint8Array(await (await fetch('/slides.pdf')).arrayBuffer());
	const loaded = performance.now();
	window.loadedAt = loaded;
	const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
	const opened = performance.now();
	const results = [];
	for (const n of pages) {
		const s = performance.now();
		const page = await doc.getPage(n);
		const base = page.getViewport({ scale: 1 });
		const scale = longSide / Math.max(base.width, base.height);
		const view = page.getViewport({ scale });
		const canvas = new OffscreenCanvas(Math.round(view.width), Math.round(view.height));
		await page.render({ canvasContext: canvas.getContext('2d'), viewport: view }).promise;
		const rendered = performance.now();
		const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 });
		const encoded = performance.now();
		const text = await page.getTextContent();
		results.push({ page: n, width: canvas.width, height: canvas.height, renderMs: rendered - s, webpMs: encoded - rendered,
			textMs: performance.now() - encoded, totalMs: performance.now() - s, webpKb: blob.size / 1024, items: text.items.length });
	}
	return { importAndFetchMs: loaded - t0, openMs: opened - loaded, results };
};
</script>`;

const kb = (bytes: number): string => (bytes / 1024).toFixed(0);

async function main(): Promise<void> {
	for (const name of ['/pdf.min.mjs', '/pdf.worker.min.mjs']) {
		const bytes = readFileSync(FILES[name]?.path ?? '');
		console.log(`${name}: ${kb(bytes.length)} KB raw, ${kb(gzipSync(bytes).length)} KB gzipped`);
	}
	const browser = await chromium.launch();
	const page = await browser.newPage();
	const late: string[] = [];
	let loaded = false;
	await page.route(`${ORIGIN}/**`, async (route) => {
		const path = new URL(route.request().url()).pathname;
		if (loaded) late.push(path);
		if (path === '/') return route.fulfill({ body: PAGE, contentType: 'text/html' });
		const file = FILES[path];
		return file
			? route.fulfill({ body: readFileSync(file.path), contentType: file.type })
			: route.fulfill({ status: 404 });
	});
	page.on('console', (message) => console.log(`[browser ${message.type()}] ${message.text()}`));
	await page.goto(`${ORIGIN}/`);
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
	const report = await page.evaluate(
		async ([pages, longSide]) => {
			const run = (window as unknown as { run: (p: number[], l: number) => Promise<unknown> }).run;
			return run(pages as number[], longSide as number);
		},
		[PAGES, LONG_SIDE] as const
	);
	loaded = true;
	console.log(`CPU throttle ${THROTTLE}×`, JSON.stringify(report, null, 1));
	console.log(
		`requests after pdf.js and the PDF were loaded: ${late.length === 0 ? 'none' : late.join(', ')}`
	);
	await browser.close();
}

await main();
