import { strToU8, zipSync } from 'fflate';
import { expect, test, type Page } from '@playwright/test';
import { OUT_OF_SPACE_MESSAGE } from '../../src/lib/services/storage-guard.ts';
import { readTable } from './idb.ts';
import { playOpenSession } from './play-session.ts';

/**
 * Phase 6 step 9 (WIP; BUILD_PLAN §7): pictures and diagrams end to end. A zip with an OSI-style
 * stack, a flow and a slide with `box:` lines is imported; the labels are placed in the image
 * editor by taps; one session shows every figure kind (bank, place by tap, type, layers, node,
 * arrow, connect); a diagram's text is edited and its unchanged cards keep their IDs. Also: an
 * EXIF-rotated photo is stored upright, and a full device shows the out-of-space message.
 */

const NOTES = `@deck Databases
@diagram stack Network layers
Application
Transport
Network
Link
@diagram flow Query plan
Parser -> Optimizer : parse tree
Optimizer -> Executor : plan
@occlusion slide.png
box: Disk
box: Buffer
box: Log`;

/** Draws an image in the browser (PNG or JPEG), so the test needs no image file. */
async function drawImage(page: Page, width: number, height: number, type: string): Promise<Buffer> {
	const base64 = await page.evaluate(
		async ([w, h, mime]) => {
			const canvas = new OffscreenCanvas(Number(w), Number(h));
			const context = canvas.getContext('2d');
			if (context) {
				context.fillStyle = '#d0d0d0';
				context.fillRect(0, 0, Number(w), Number(h));
			}
			const blob = await canvas.convertToBlob({ type: String(mime) });
			const bytes = new Uint8Array(await blob.arrayBuffer());
			let binary = '';
			for (let at = 0; at < bytes.length; at += 0x8000) {
				binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
			}
			return btoa(binary);
		},
		[width, height, type] as const
	);
	return Buffer.from(base64, 'base64');
}

/** A JPEG with an EXIF APP1 segment carrying only the orientation tag. */
function withOrientation(jpeg: Buffer, orientation: number): Buffer {
	const tiff = Buffer.from([
		...[0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08], // big-endian header, IFD at 8
		...[0x00, 0x01], // one entry
		...[0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00],
		...[0x00, 0x00, 0x00, 0x00] // no next IFD
	]);
	const body = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
	const length = body.length + 2;
	const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, length >> 8, length & 0xff]), body]);
	return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

async function newCourse(page: Page): Promise<void> {
	await page.goto('/import');
	await page.getByLabel('New course').fill('Databases');
	await page.getByRole('button', { name: 'Create course' }).click();
	await expect(page.getByRole('combobox', { name: 'Course' })).toHaveValue(/.+/);
}

async function importZip(page: Page): Promise<void> {
	await newCourse(page);
	const png = await drawImage(page, 400, 200, 'image/png');
	const zip = zipSync({
		'lecture/notes.txt': strToU8(NOTES),
		'lecture/slide.png': new Uint8Array(png)
	});
	await page.getByLabel('Attach images or a .zip').setInputFiles({
		name: 'lecture.zip',
		mimeType: 'application/zip',
		buffer: Buffer.from(zip)
	});
	await expect(page.getByText('Attached: slide.png')).toBeVisible();
	await page.getByRole('button', { name: 'Check' }).click();
	await page.getByRole('button', { name: 'Add to course' }).click();
	await expect(page.getByRole('status').first()).toContainText('Added 3 notes');
}

/** Places each tray label by tapping it, then a spot on the picture (no dragging). */
async function placeLabels(page: Page, labels: string[]): Promise<void> {
	const editor = page.locator('[data-occlusion-editor]');
	const picture = editor.locator('[data-figure]');
	await expect(picture.locator('img')).toBeVisible();
	const box = await picture.boundingBox();
	if (!box) throw new Error('The picture has no size');
	for (const [i, label] of labels.entries()) {
		await editor.getByRole('button', { name: label, exact: true }).click();
		await expect(editor.getByText(`Tap the picture where “${label}” goes.`)).toBeVisible();
		await picture.click({ position: { x: box.width * (0.2 + 0.3 * i), y: box.height / 2 } });
	}
	await expect(editor.getByLabel('Labels to place')).toHaveCount(0);
}

async function cardIdsOf(page: Page, noteId: string): Promise<Record<string, string>> {
	const cards = await readTable(page, 'cards');
	return Object.fromEntries(
		cards
			.filter((card) => card.noteId === noteId && card.deleted !== true)
			.map((card) => [String(card.variant), String(card.id)])
	);
}

test.describe('diagrams and pictures', () => {
	test.use({ reducedMotion: 'reduce', actionTimeout: 10_000 });

	test('import a zip, place labels, study every figure kind, edit a diagram', async ({ page }) => {
		test.setTimeout(240_000);
		await importZip(page);

		// The done screen links the picture whose labels still need a place.
		const place = page.locator('[data-place-labels]');
		await expect(place).toHaveText(/Place 3 labels · slide\.png/);
		await place.click();
		await page.waitForURL(/\/course\/[^/]+\/image\/[^/]+$/);
		await placeLabels(page, ['Disk', 'Buffer', 'Log']);
		await page.locator('[data-figure-save]').click();
		await expect(page.locator('[data-figure-saved]')).toHaveText('Saved: 3 cards.');
		const notes = await readTable(page, 'notes');
		const image = notes.find((note) => note.type === 'occlusion');
		const imagePayload = image?.payload as { boxes: { label: string }[]; unplaced?: string[] };
		expect(imagePayload.boxes.map((b) => b.label)).toEqual(['Disk', 'Buffer', 'Log']);
		expect(imagePayload.unplaced).toBeUndefined();

		// One session over the pictures: every figure kind, answered by taps only.
		const courseId = page.url().match(/\/course\/([^/]+)\//)?.[1] ?? '';
		await page.goto(`/dev/session?figures=${courseId}`);
		await page.locator('[data-start-figures]').click();
		await page.waitForURL(/\/study\//);
		const seen = await playOpenSession(page);
		for (const kind of [
			'occlusionBank',
			'occlusionDrag',
			'occlusionType',
			'layerOrder',
			'nodeCloze',
			'edgeCloze',
			'structureRebuild'
		]) {
			expect(seen, kind).toContain(kind);
		}

		// The card list opens the diagram editor; a text edit keeps unchanged cards' IDs.
		await page.goto(`/course/${courseId}/cards`);
		const isFlow = (payload: unknown) => (payload as { kind?: string }).kind === 'flow';
		const flowId = String(notes.find((note) => isFlow(note.payload))?.id);
		const before = await cardIdsOf(page, flowId);
		await page.locator(`[data-note-id="${flowId}"] [data-edit-in-editor]`).click();
		await page.waitForURL(/\/course\/[^/]+\/diagram\/[^/]+$/);
		const textBox = page.locator('[data-diagram-text]');
		await expect(textBox).toHaveValue(/Parser -> Optimizer/);
		await textBox.fill(
			'Parser -> Optimizer : parse tree\nOptimizer -> Executor : plan\nExecutor -> Storage : reads'
		);
		await expect(page.locator('[data-diagram-errors]')).toHaveCount(0);
		await page.locator('[data-figure-save]').click();
		await expect(page.locator('[data-figure-saved]')).toContainText('Saved:');
		const after = await cardIdsOf(page, flowId);
		for (const [variant, id] of Object.entries(before)) expect(after[variant], variant).toBe(id);
		expect(Object.keys(after).length).toBeGreaterThan(Object.keys(before).length);
	});

	test('Manual mode makes a diagram and opens its editor', async ({ page }) => {
		await page.goto('/course/new');
		await page.getByLabel('Course name').fill('By hand');
		await page.getByLabel('First topic').fill('Layers');
		await page.locator('[data-create-course]').click();
		await page.waitForURL(/\/add\?topic=/);
		await page.getByLabel('Card type').selectOption({ label: 'Diagram' });
		await page.getByLabel('Diagram name').fill('TCP/IP');
		await page.locator('[data-diagram-text]').fill('Application\nTransport\nInternet\nLink');
		await page.locator('[data-make-diagram]').click();
		await page.waitForURL(/\/course\/[^/]+\/diagram\/[^/]+$/);
		await expect(page.locator('[data-diagram-text]')).toHaveValue(/Transport/);
	});

	test('stores an EXIF-rotated photo upright (Manual mode image)', async ({ page }) => {
		await page.goto('/course/new');
		await page.getByLabel('Course name').fill('Photos');
		await page.getByLabel('First topic').fill('Board');
		await page.locator('[data-create-course]').click();
		await page.waitForURL(/\/add\?topic=/);
		await page.getByLabel('Card type').selectOption({ label: 'Image (hide parts)' });
		// Stored 40 × 20, orientation 6 (rotate 90°): shown and stored as 20 × 40.
		const jpeg = withOrientation(await drawImage(page, 40, 20, 'image/jpeg'), 6);
		await page.getByLabel('Choose an image').setInputFiles({
			name: 'board.jpg',
			mimeType: 'image/jpeg',
			buffer: jpeg
		});
		await page.waitForURL(/\/course\/[^/]+\/image\/[^/]+$/);
		const [media] = await readTable(page, 'media');
		expect({ width: media?.width, height: media?.height }).toEqual({ width: 20, height: 40 });
	});

	test('a full device shows the out-of-space message', async ({ page }) => {
		await page.goto('/course/new');
		await page.getByLabel('Course name').fill('Full');
		await page.getByLabel('First topic').fill('One');
		await page.locator('[data-create-course]').click();
		await page.waitForURL(/\/add\?topic=/);
		// Stub: IndexedDB refuses image writes as a full quota would.
		await page.evaluate(() => {
			for (const method of ['put', 'add'] as const) {
				const original = IDBObjectStore.prototype[method];
				IDBObjectStore.prototype[method] = function (this: IDBObjectStore, ...args: [unknown]) {
					if (this.name === 'media') throw new DOMException('Quota exceeded', 'QuotaExceededError');
					return original.apply(this, args);
				};
			}
		});
		await page.getByLabel('Card type').selectOption({ label: 'Image (hide parts)' });
		await page.getByLabel('Choose an image').setInputFiles({
			name: 'slide.png',
			mimeType: 'image/png',
			buffer: await drawImage(page, 40, 20, 'image/png')
		});
		await expect(page.getByRole('alert')).toHaveText(OUT_OF_SPACE_MESSAGE);
		expect(await readTable(page, 'notes')).toHaveLength(0);
	});
});
