/**
 * Phase 6 step 10 spike (not part of verify): tesseract.js in Chromium on the six pasted-picture
 * slide pages that pdf.js could not read. All files are self-hosted (workerPath, corePath,
 * langPath under /ocr/), every request is logged, and the pages are recognised twice:
 * unthrottled (accuracy, per page-segmentation mode) and with the CPU throttled 4× (time).
 *
 * Usage: node scripts/spike/ocr-spike.ts
 * Output: test-results/spike/ocr.json and a summary on stdout.
 *
 * @see docs/WIP.md step 10, docs/spikes/OCR_SPIKE.md
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { chromium, type Page } from '@playwright/test';
import { DIAGRAM_LABELS } from '../../tests/fixtures/spike/truth.ts';

const ORIGIN = 'http://spike.local';
const PAGES = [10, 12, 15, 19, 21, 30];
const MODES = ['3', '11'];
const VARIANTS = ['page', 'crop', 'crop2x'];
const THROTTLE = 4;
const CORE_DIR = 'node_modules/tesseract.js-core';
const LANG_FILE = 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz';

type Box = { x0: number; y0: number; x1: number; y1: number };
type Word = { text: string; confidence: number; bbox: Box };
type PageResult = { page: number; ms: number; width: number; height: number; lines: Word[][] };
type RunReport = { initMs: number; mode: string; pages: PageResult[] };

function serve(path: string): { body: Buffer; type: string } | null {
	if (path === '/') return { body: Buffer.from(PAGE_HTML), type: 'text/html' };
	if (path === '/tesseract.esm.min.js' || path === '/ocr/worker.min.js') {
		const file = path === '/tesseract.esm.min.js' ? 'tesseract.esm.min.js' : 'worker.min.js';
		return {
			body: readFileSync(`node_modules/tesseract.js/dist/${file}`),
			type: 'text/javascript'
		};
	}
	if (path.startsWith('/ocr/core/')) {
		const name = path.slice('/ocr/core/'.length);
		if (!readdirSync(CORE_DIR).includes(name)) return null;
		return { body: readFileSync(`${CORE_DIR}/${name}`), type: 'text/javascript' };
	}
	if (path === '/ocr/lang/eng.traineddata.gz') {
		return { body: readFileSync(LANG_FILE), type: 'application/octet-stream' };
	}
	const page = /^\/page-(\d\d)\.png$/.exec(path);
	if (page)
		return { body: readFileSync(`tests/fixtures/spike/page-${page[1]}.png`), type: 'image/png' };
	return null;
}

const PAGE_HTML = `<!doctype html><meta charset="utf-8"><script type="module">
import Tesseract from '/tesseract.esm.min.js';
const prepare = async (blob, variant, minY) => {
	const bitmap = await createImageBitmap(blob);
	if (variant === 'page') return { image: blob, top: 0, scale: 1, width: bitmap.width, height: bitmap.height };
	const top = Math.round(minY * bitmap.height);
	const scale = variant === 'crop2x' ? 2 : 1;
	const canvas = new OffscreenCanvas(bitmap.width * scale, (bitmap.height - top) * scale);
	const ctx = canvas.getContext('2d');
	if (variant === 'crop2x') ctx.filter = 'grayscale(1) contrast(1.4)';
	ctx.drawImage(bitmap, 0, top, bitmap.width, bitmap.height - top, 0, 0, canvas.width, canvas.height);
	return { image: canvas, top, scale, width: bitmap.width, height: bitmap.height };
};
window.run = async (pages, mode, variant, minYs) => {
	const t0 = performance.now();
	const worker = await Tesseract.createWorker('eng', 1, {
		workerPath: '/ocr/worker.min.js', corePath: '/ocr/core', langPath: '/ocr/lang', gzip: true
	});
	await worker.setParameters({ tessedit_pageseg_mode: mode });
	const initMs = performance.now() - t0;
	const out = [];
	for (const n of pages) {
		const blob = await (await fetch('/page-' + String(n).padStart(2, '0') + '.png')).blob();
		const s = performance.now();
		const prep = await prepare(blob, variant, minYs[n]);
		const { data } = await worker.recognize(prep.image, {}, { blocks: true });
		const map = (b) => ({ x0: b.x0 / prep.scale, x1: b.x1 / prep.scale, y0: b.y0 / prep.scale + prep.top, y1: b.y1 / prep.scale + prep.top });
		const lines = data.blocks.flatMap((b) => b.paragraphs.flatMap((p) => p.lines.map((l) =>
			l.words.map((w) => ({ text: w.text, confidence: w.confidence, bbox: map(w.bbox) })))));
		out.push({ page: n, ms: performance.now() - s, width: prep.width, height: prep.height, lines });
	}
	await worker.terminate();
	return { initMs, mode: mode + '/' + variant, pages: out };
};
window.ready = true;
</script>`;

const norm = (text: string): string =>
	text
		.toLowerCase()
		.replace(/[‘’`'"“”|,.;:—–_[\]{}]/g, '')
		.replace(/\s+/g, '');

/** Strict: exact after normalising. Fuzzy: hyphens dropped, and FUZZY_EDITS (≤4 chars 0, ≤8 1, else 2). */
function matches(read: string, want: string, fuzzy: boolean): boolean {
	if (!fuzzy) return read === want;
	const a = read.replace(/-/g, '');
	const b = want.replace(/-/g, '');
	const allowed = b.length <= 4 ? 0 : b.length <= 8 ? 1 : 2;
	return distance(a, b) <= allowed;
}

function distance(a: string, b: string): number {
	let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i += 1) {
		const next = [i];
		for (let j = 1; j <= b.length; j += 1) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			next.push(Math.min((prev[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost));
		}
		prev = next;
	}
	return prev[b.length] ?? 0;
}

/** A label is hit when one word, or neighbours on one line, read exactly as it inside the figure. */
function findLabel(label: string, result: PageResult, minY: number, fuzzy: boolean): Word | null {
	const want = norm(label);
	for (const line of result.lines) {
		for (let start = 0; start < line.length; start += 1) {
			let text = '';
			for (let end = start; end < line.length && end < start + 3; end += 1) {
				text += norm(line[end]?.text ?? '');
				const first = line[start];
				const last = line[end];
				if (!first || !last || !matches(text, want, fuzzy)) continue;
				const bbox = { x0: first.bbox.x0, y0: first.bbox.y0, x1: last.bbox.x1, y1: last.bbox.y1 };
				const inFigure = bbox.y0 >= minY * result.height && bbox.x1 - bbox.x0 < result.width / 2;
				if (inFigure) return { text, confidence: first.confidence, bbox };
			}
		}
	}
	return null;
}

type Score = {
	mode: string;
	initMs: number;
	strict: number;
	fuzzy: number;
	fuzzy60: number;
	total: number;
	pages: unknown[];
};

function score(report: RunReport): Score {
	const out = {
		mode: report.mode,
		initMs: Math.round(report.initMs),
		strict: 0,
		fuzzy: 0,
		fuzzy60: 0,
		total: 0
	};
	const pages = report.pages.map((result) => {
		const truth = DIAGRAM_LABELS[result.page];
		if (!truth) throw new Error(`no truth for page ${result.page}`);
		const missed: string[] = [];
		let hits = 0;
		for (const label of truth.labels) {
			out.total += 1;
			if (findLabel(label, result, truth.minY, false)) out.strict += 1;
			const word = findLabel(label, result, truth.minY, true);
			if (!word) missed.push(label);
			else {
				hits += 1;
				out.fuzzy += 1;
				if (word.confidence >= 60) out.fuzzy60 += 1;
			}
		}
		const read = result.lines
			.map((line) =>
				line
					.filter((w) => w.bbox.y0 >= truth.minY * result.height)
					.map((w) => w.text)
					.join(' ')
			)
			.filter((line) => line.trim() !== '');
		return {
			page: result.page,
			ms: Math.round(result.ms),
			hits,
			of: truth.labels.length,
			missed,
			read
		};
	});
	return { ...out, pages };
}

async function run(page: Page, mode: string, variant: string): Promise<RunReport> {
	const minYs = Object.fromEntries(PAGES.map((n) => [n, DIAGRAM_LABELS[n]?.minY ?? 0]));
	return page.evaluate(
		async ([pages, m, v, y]) => {
			type Run = (
				p: number[],
				m: string,
				v: string,
				y: Record<number, number>
			) => Promise<RunReport>;
			return (window as unknown as { run: Run }).run(pages, m, v, y);
		},
		[PAGES, mode, variant, minYs] as const
	);
}

function sizes(): Record<string, string> {
	const kb = (bytes: number): string => `${(bytes / 1024).toFixed(0)} KB`;
	const files: Record<string, string> = {
		'tesseract.esm.min.js': 'node_modules/tesseract.js/dist/tesseract.esm.min.js',
		'worker.min.js': 'node_modules/tesseract.js/dist/worker.min.js',
		'core (relaxedsimd-lstm .wasm.js)': `${CORE_DIR}/tesseract-core-relaxedsimd-lstm.wasm.js`,
		'core (simd-lstm .wasm.js)': `${CORE_DIR}/tesseract-core-simd-lstm.wasm.js`,
		'core (lstm .wasm.js, no SIMD)': `${CORE_DIR}/tesseract-core-lstm.wasm.js`,
		'eng.traineddata.gz (best_int)': LANG_FILE
	};
	return Object.fromEntries(
		Object.entries(files).map(([name, path]) => {
			const bytes = readFileSync(path);
			return [name, `${kb(bytes.length)} raw, ${kb(gzipSync(bytes).length)} gzipped`];
		})
	);
}

async function main(): Promise<void> {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	const requests: string[] = [];
	await page.context().route('**/*', async (route) => {
		const url = new URL(route.request().url());
		requests.push(url.origin === ORIGIN ? url.pathname : url.href);
		const file = url.origin === ORIGIN ? serve(url.pathname) : null;
		return file ? route.fulfill({ body: file.body, contentType: file.type }) : route.abort();
	});
	page.on('console', (m) => {
		if (m.type() === 'error') console.log(`[browser] ${m.text()}`);
	});
	await page.goto(`${ORIGIN}/`);
	await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready === true);

	const accuracy: Score[] = [];
	for (const variant of VARIANTS)
		for (const mode of MODES) accuracy.push(score(await run(page, mode, variant)));
	const firstRun = [...requests];

	const best = [...accuracy].sort((a, b) => b.fuzzy - a.fuzzy)[0];
	const [bestMode, bestVariant] = (best?.mode ?? '11/page').split('/');
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
	const before = requests.length;
	const throttled = score(await run(page, bestMode ?? '11', bestVariant ?? 'page'));
	const laterRequests = requests.slice(before);

	const report = { sizes: sizes(), accuracy, throttled, firstRun, laterRequests };
	mkdirSync('test-results/spike', { recursive: true });
	writeFileSync('test-results/spike/ocr.json', JSON.stringify(report, null, 1));
	console.log(JSON.stringify(report.sizes, null, 1));
	for (const a of accuracy) {
		const ms = (a.pages as { ms: number }[]).map((p) => p.ms).join('/');
		console.log(
			`psm/variant ${a.mode}: strict ${a.strict}, fuzzy ${a.fuzzy} (conf≥60 ${a.fuzzy60}) of ${a.total}; init ${a.initMs} ms; pages ${ms} ms`
		);
	}
	console.log(
		`throttled ${THROTTLE}× psm ${throttled.mode}: init ${throttled.initMs} ms; pages`,
		(throttled.pages as { page: number; ms: number }[])
			.map((p) => `${p.page}: ${p.ms} ms`)
			.join(', ')
	);
	console.log('requests (first run):', [...new Set(firstRun)].join(', '));
	console.log('requests (throttled run):', [...new Set(laterRequests)].join(', '));
	await browser.close();
}

await main();
