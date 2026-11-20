/**
 * Phase 6 step 1 spike (not part of verify): does pdf.js give text positions for slide labels,
 * so occlusion boxes could come from a PDF's own text instead of OCR?
 *
 * Usage: node scripts/spike/pdf-spike.ts [path/to/slides.pdf]
 * Writes test-results/spike/pdf-text.json and prints a summary. Ground truth lives in the git-ignored
 * `tests/fixtures/spike/truth.ts`, written by hand from the slide pictures (not from the PDF's text layer).
 *
 * @see docs/WIP.md step 1, docs/spikes/PDF_SPIKE.md
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

interface Truth {
	DIAGRAM_LABELS: Record<number, { minY: number; labels: string[] }>;
	PLAIN_PHRASES: Record<number, string[]>;
}

/** Loaded at run time: the file is git-ignored with the slides, so CI never type-checks against it. */
const TRUTH_PATH = 'tests/fixtures/spike/truth.ts';
const { DIAGRAM_LABELS, PLAIN_PHRASES } = (await import(pathToFileURL(TRUTH_PATH).href)) as Truth;

interface Item {
	text: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

interface PageReport {
	page: number;
	items: number;
	images: number;
	paths: number;
	diagram: { expected: number; found: number; split: number; missing: string[] };
	plain: { expected: number; found: number; missing: string[] };
}

const PDF = process.argv[2] ?? 'tests/fixtures/spike/slides.pdf';

const norm = (text: string): string => text.toLowerCase().replace(/\s+/g, ' ').trim();

/** Text items as fractions of the page box (origin top-left). */
function toItems(
	raw: { str: string; transform: number[]; width: number; height: number }[],
	pw: number,
	ph: number
): Item[] {
	return raw
		.filter((item) => item.str.trim() !== '')
		.map((item) => {
			const [, , , , tx = 0, ty = 0] = item.transform;
			const h = item.height || Math.abs(item.transform[3] ?? 0);
			return { text: item.str, x: tx / pw, y: 1 - (ty + h) / ph, w: item.width / pw, h: h / ph };
		});
}

/** Items on one baseline whose gap is under a character height, joined into lines. */
function lines(items: Item[]): Item[] {
	const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
	const out: Item[] = [];
	for (const item of sorted) {
		const last = out.at(-1);
		const sameLine = last && Math.abs(last.y - item.y) < item.h * 0.5;
		const gapX = last ? item.x - (last.x + last.w) : 0;
		if (last && sameLine && gapX > -item.h * 0.3 && gapX < item.h * 0.8) {
			const gap = item.x - (last.x + last.w) > item.h * 0.15 ? ' ' : '';
			out[out.length - 1] = {
				...last,
				text: last.text + gap + item.text,
				w: item.x + item.w - last.x
			};
		} else out.push({ ...item });
	}
	return out;
}

/** Single characters stacked vertically (two-digit keys drawn one digit per line). */
function stacked(items: Item[]): Item[] {
	const chars = items.filter((item) => item.text.trim().length === 1);
	const out: Item[] = [];
	for (const top of chars) {
		const below = chars.find(
			(other) =>
				other !== top &&
				Math.abs(other.x - top.x) < top.h * 0.4 &&
				other.y > top.y &&
				other.y - top.y < top.h * 1.6
		);
		if (below) out.push({ ...top, text: top.text + below.text, h: below.y + below.h - top.y });
	}
	return out;
}

/** A label is found when a text item or a joined line holds it as a whole token, with a box inside the page. */
function findLabel(label: string, pool: Item[]): boolean {
	const want = norm(label);
	const token = new RegExp(
		`(^|[^a-z0-9])${want.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}($|[^a-z0-9])`
	);
	return pool.some(
		(item) =>
			token.test(norm(item.text)) &&
			item.w > 0 &&
			item.x >= 0 &&
			item.y >= 0 &&
			item.x + item.w <= 1.01 &&
			item.y + item.h <= 1.01
	);
}

async function countOps(page: {
	getOperatorList(): Promise<{ fnArray: number[] }>;
}): Promise<{ images: number; paths: number }> {
	const { fnArray } = await page.getOperatorList();
	const images = fnArray.filter(
		(fn) =>
			fn === OPS.paintImageXObject ||
			fn === OPS.paintInlineImageXObject ||
			fn === OPS.paintImageMaskXObject
	).length;
	const paths = fnArray.filter((fn) => fn === OPS.constructPath).length;
	return { images, paths };
}

async function main(): Promise<void> {
	const data = new Uint8Array(readFileSync(PDF));
	const start = performance.now();
	const doc = await getDocument({ data, isEvalSupported: false }).promise;
	const reports: PageReport[] = [];
	const boxes: Record<number, Item[]> = {};
	for (let n = 1; n <= doc.numPages; n += 1) {
		const page = await doc.getPage(n);
		const view = page.getViewport({ scale: 1 });
		const content = await page.getTextContent();
		const items = toItems(content.items as never, view.width, view.height);
		const joined = lines(items);
		const split = stacked(items);
		boxes[n] = joined;
		const truth = DIAGRAM_LABELS[n] ?? { minY: 0, labels: [] };
		const labels = truth.labels;
		const inFigure = (pool: Item[]): Item[] => pool.filter((item) => item.y >= truth.minY);
		const direct = labels.filter((label) => findLabel(label, inFigure([...items, ...joined])));
		const viaSplit = labels.filter(
			(label) => !direct.includes(label) && findLabel(label, inFigure(split))
		);
		const phrases = PLAIN_PHRASES[n] ?? [];
		const allText = norm(joined.map((item) => item.text).join(' '));
		const plainFound = phrases.filter((phrase) => allText.includes(norm(phrase)));
		reports.push({
			page: n,
			items: items.length,
			...(await countOps(page)),
			diagram: {
				expected: labels.length,
				found: direct.length + viaSplit.length,
				split: viaSplit.length,
				missing: labels.filter((label) => !direct.includes(label) && !viaSplit.includes(label))
			},
			plain: {
				expected: phrases.length,
				found: plainFound.length,
				missing: phrases.filter((p) => !plainFound.includes(p))
			}
		});
	}
	const ms = performance.now() - start;
	mkdirSync('test-results/spike', { recursive: true });
	writeFileSync(
		'test-results/spike/pdf-text.json',
		JSON.stringify({ pages: doc.numPages, ms, reports, boxes }, null, 1)
	);
	const sum = (pick: (r: PageReport) => number): number =>
		reports.reduce((total, r) => total + pick(r), 0);
	console.log(
		`pages ${doc.numPages}, text + operator lists in ${ms.toFixed(0)} ms (Node, desktop CPU)`
	);
	console.log(
		`diagram labels: ${sum((r) => r.diagram.found)}/${sum((r) => r.diagram.expected)} found (${sum((r) => r.diagram.split)} only after joining stacked digits)`
	);
	console.log(`plain phrases: ${sum((r) => r.plain.found)}/${sum((r) => r.plain.expected)} found`);
	for (const r of reports.filter(
		(rep) => rep.diagram.expected > 0 || rep.plain.missing.length > 0
	)) {
		console.log(
			`p${r.page}: items ${r.items}, images ${r.images}, paths ${r.paths}, diagram ${r.diagram.found}/${r.diagram.expected}` +
				(r.diagram.split ? ` (split ${r.diagram.split})` : '') +
				(r.diagram.missing.length
					? ` missing [${r.diagram.missing.slice(0, 6).join(', ')}${r.diagram.missing.length > 6 ? ', …' : ''}]`
					: '') +
				(r.plain.missing.length ? ` plain missing [${r.plain.missing.join(' | ')}]` : '')
		);
	}
}

await main();
