import { strToU8, zipSync } from 'fflate';
import { expect, test, type Page } from '@playwright/test';
import { IMAGE_MAX_PX } from '../../src/lib/config/defaults.ts';
import { CHATBOT_PROMPT } from '../../src/lib/import/prompt.ts';

const SAMPLE = `@deck Networking
@keyterms
TCP :: Transmission Control Protocol
@read
TCP guarantees ordered delivery.
@fact
TCP :: reliable [CHECK]
this line is wrong
@deck Databases
@cloze
A {{key}} identifies a row.
@coverage
Transport, Keys`;

/** Reads every record of a table straight from IndexedDB, as the app stored it. */
async function readTable(page: Page, table: string): Promise<Record<string, unknown>[]> {
	return page.evaluate(
		(name) =>
			new Promise<Record<string, unknown>[]>((resolve, reject) => {
				const open = indexedDB.open('snowpack');
				open.onerror = () => reject(open.error);
				open.onsuccess = () => {
					const request = open.result.transaction(name).objectStore(name).getAll();
					request.onerror = () => reject(request.error);
					request.onsuccess = () => {
						open.result.close();
						resolve(request.result);
					};
				};
			}),
		table
	);
}

/** Readable size and type of the stored images. */
async function readMedia(page: Page): Promise<{ width: number; height: number; type: string }[]> {
	return page.evaluate(
		() =>
			new Promise((resolve, reject) => {
				const open = indexedDB.open('snowpack');
				open.onerror = () => reject(open.error);
				open.onsuccess = () => {
					const request = open.result.transaction('media').objectStore('media').getAll();
					request.onsuccess = () => {
						open.result.close();
						const rows = request.result as { width: number; height: number; blob: Blob }[];
						resolve(rows.map(({ width, height, blob }) => ({ width, height, type: blob.type })));
					};
				};
			})
	);
}

/** Draws a PNG in the browser, so the test needs no image file. */
async function makePng(page: Page, width: number, height: number): Promise<Buffer> {
	const base64 = await page.evaluate(
		async ([w, h]) => {
			const canvas = new OffscreenCanvas(w ?? 1, h ?? 1);
			const context = canvas.getContext('2d');
			if (context) context.fillRect(0, 0, w ?? 1, h ?? 1);
			const blob = await canvas.convertToBlob({ type: 'image/png' });
			const bytes = new Uint8Array(await blob.arrayBuffer());
			return btoa(String.fromCharCode(...bytes));
		},
		[width, height]
	);
	return Buffer.from(base64, 'base64');
}

async function openWithCourse(page: Page): Promise<void> {
	await page.goto('/import');
	await page.getByLabel('New course').fill('Networks');
	await page.getByRole('button', { name: 'Create course' }).click();
	await expect(page.getByRole('combobox', { name: 'Course' })).toHaveValue(/.+/);
}

const pasteArea = (page: Page) => page.getByLabel("Paste the chatbot's text");
const attach = (page: Page) => page.getByLabel('Attach images or a .zip');

test.describe('import screen', () => {
	test('is reached from the home screen, with no sideways scroll', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: /import/i }).click();
		await expect(page.getByRole('heading', { name: 'Import', exact: true })).toBeVisible();
		await page.getByLabel('New course').fill('Networks');
		await page.getByRole('button', { name: 'Create course' }).click();
		await pasteArea(page).fill(SAMPLE);
		await page.getByRole('button', { name: 'Check' }).click();
		await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible();
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBeLessThanOrEqual(0);
	});

	test('previews counts, errors, [CHECK] items and coverage', async ({ page }) => {
		await openWithCourse(page);
		await pasteArea(page).fill(SAMPLE);
		await page.getByRole('button', { name: 'Check' }).click();
		await expect(page.getByText('1 to fix')).toBeVisible();
		await expect(page.getByRole('button', { name: /^Line 8: Expected/ })).toBeVisible();
		await expect(page.getByText('Key terms: 1')).toBeVisible();
		await expect(page.getByText('Facts: 1')).toBeVisible();
		await expect(page.getByText('Fill-in sentences: 1')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Line 7: TCP :: reliable' })).toBeVisible();
		await expect(page.getByText('Transport', { exact: true })).toBeVisible();
		expect(await readTable(page, 'notes')).toEqual([]);
	});

	test('tapping an error selects that line in the text', async ({ page }) => {
		await openWithCourse(page);
		await pasteArea(page).fill(SAMPLE);
		await page.getByRole('button', { name: 'Check' }).click();
		await page.getByRole('button', { name: /^Line 8:/ }).click();
		const selected = await pasteArea(page).evaluate((element) => {
			const area = element as HTMLTextAreaElement;
			return area.value.slice(area.selectionStart, area.selectionEnd);
		});
		expect(selected).toBe('this line is wrong');
	});

	test('commits the valid part with the tapped placements', async ({ page }) => {
		await openWithCourse(page);
		await pasteArea(page).fill(SAMPLE);
		await page.getByRole('button', { name: 'Check' }).click();
		const placement = page.getByRole('group', { name: 'Placement for Networking' });
		await placement.getByRole('button', { name: 'Read it' }).click();
		await expect(placement.getByRole('button', { name: 'Read it' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await page.getByRole('button', { name: 'Add to course' }).click();
		await expect(page.getByRole('status')).toHaveText('Added 3 notes and 4 cards across 2 topics.');
		await expect(pasteArea(page)).toHaveValue('');

		const topics = await readTable(page, 'topics');
		expect(topics.map(({ name, placement: value }) => [name, value]).sort()).toEqual([
			['Databases', 'unread'],
			['Networking', 'read']
		]);
		expect(await readTable(page, 'cards')).toHaveLength(4);
	});

	test('the course survives a reload, and a later import adds to its topic', async ({ page }) => {
		await openWithCourse(page);
		await pasteArea(page).fill('@deck Networking');
		await page.getByRole('button', { name: 'Check' }).click();
		await page.getByRole('button', { name: 'Add to course' }).click();
		await expect(page.getByRole('status')).toBeVisible();

		await page.reload();
		await expect(page.getByRole('combobox', { name: 'Course' })).toHaveValue(/.+/);
		await pasteArea(page).fill('@deck Networking\n@scenario\nvideo call :: UDP');
		await page.getByRole('button', { name: 'Check' }).click();
		await expect(page.getByText('Adds to this topic: 1 notes, 1 cards')).toBeVisible();
		await page.getByRole('button', { name: 'Add to course' }).click();
		await expect(page.getByRole('status')).toContainText('Added 1 notes');
		expect(await readTable(page, 'topics')).toHaveLength(1);
	});

	test('copies the chatbot prompt word for word', async ({ page, context, browserName }) => {
		test.skip(browserName !== 'chromium', 'Only Chromium grants clipboard access to a test');
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await page.goto('/import');
		await page.getByRole('button', { name: 'Copy the chatbot prompt' }).click();
		await expect(page.getByRole('status')).toContainText('Prompt copied');
		const copied = await page.evaluate(() => navigator.clipboard.readText());
		// The Windows clipboard stores line breaks as CRLF, which is not a change of wording.
		expect(copied.replace(/\r\n/g, '\n')).toBe(CHATBOT_PROMPT);
	});
});

test.describe('import images', () => {
	test('resizes an occlusion image to WebP and stores it once', async ({ page }) => {
		await openWithCourse(page);
		const png = await makePng(page, IMAGE_MAX_PX * 2, IMAGE_MAX_PX);
		await attach(page).setInputFiles([
			{ name: 'slide.png', mimeType: 'image/png', buffer: png },
			{ name: 'copy.png', mimeType: 'image/png', buffer: png }
		]);
		await expect(page.getByText('Attached: slide.png, copy.png')).toBeVisible();
		await pasteArea(page).fill('@deck A\n@occlusion slide.png\n@occlusion copy.png');
		await page.getByRole('button', { name: 'Check' }).click();
		await page.getByRole('button', { name: 'Add to course' }).click();
		await expect(page.getByRole('status')).toContainText('Added 2 notes');
		expect(await readMedia(page)).toEqual([
			{ width: IMAGE_MAX_PX, height: IMAGE_MAX_PX / 2, type: 'image/webp' }
		]);
	});

	test('names a pasted screenshot so a block can refer to it', async ({ page }) => {
		await openWithCourse(page);
		const png = await makePng(page, 8, 8);
		await pasteArea(page).evaluate(
			(element, bytes) => {
				const data = new DataTransfer();
				data.items.add(new File([new Uint8Array(bytes)], 'image.png', { type: 'image/png' }));
				element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
			},
			[...png]
		);
		await expect(page.getByText('Attached: pasted-1.png')).toBeVisible();
		await pasteArea(page).fill('@deck A\n@occlusion pasted-1.png');
		await page.getByRole('button', { name: 'Check' }).click();
		await page.getByRole('button', { name: 'Add to course' }).click();
		await expect(page.getByRole('status')).toContainText('Added 1 notes');
	});

	test('offers the camera for a photo', async ({ page }) => {
		await page.goto('/import');
		const camera = page.getByLabel('Take a photo');
		await expect(camera).toHaveAttribute('capture', 'environment');
		await expect(camera).toHaveAttribute('accept', 'image/*');
	});

	test('reports @occlusion when its image is missing', async ({ page }) => {
		await openWithCourse(page);
		await pasteArea(page).fill('@deck A\n@occlusion gone.png');
		await page.getByRole('button', { name: 'Check' }).click();
		await expect(
			page.getByRole('button', { name: 'Line 2: Image "gone.png" is not attached.' })
		).toBeVisible();
	});

	test('reports a file that is not an image', async ({ page }) => {
		await openWithCourse(page);
		await attach(page).setInputFiles({
			name: 'fake.png',
			mimeType: 'image/png',
			buffer: Buffer.from('not an image')
		});
		await expect(page.getByRole('alert')).toContainText('fake.png');
	});

	test('loads the text and images of a zip', async ({ page }) => {
		await openWithCourse(page);
		const png = await makePng(page, 8, 8);
		const zip = zipSync({
			'lecture/notes.txt': strToU8('@deck A\n@occlusion images/slide.png'),
			'lecture/images/slide.png': new Uint8Array(png)
		});
		await attach(page).setInputFiles({
			name: 'lecture.zip',
			mimeType: 'application/zip',
			buffer: Buffer.from(zip)
		});
		await expect(pasteArea(page)).toHaveValue('@deck A\n@occlusion images/slide.png');
		await expect(page.getByText('Attached: slide.png')).toBeVisible();
		await page.getByRole('button', { name: 'Check' }).click();
		await page.getByRole('button', { name: 'Add to course' }).click();
		await expect(page.getByRole('status')).toContainText('Added 1 notes');
		expect(await readTable(page, 'media')).toHaveLength(1);
	});

	test('reports a broken zip', async ({ page }) => {
		await openWithCourse(page);
		await attach(page).setInputFiles({
			name: 'broken.zip',
			mimeType: 'application/zip',
			buffer: Buffer.from('not a zip')
		});
		await expect(page.getByRole('status')).toContainText('could not be read as a zip');
	});
});

test.describe('import offline', () => {
	test('works with no network once the app has loaded', async ({ page, context }) => {
		await page.goto('/');
		await page.evaluate(async () => {
			await navigator.serviceWorker.ready;
		});
		await page.reload();
		await context.setOffline(true);
		await page.goto('/import');
		await page.getByLabel('New course').fill('Networks');
		await page.getByRole('button', { name: 'Create course' }).click();
		await pasteArea(page).fill('@deck A\n@scenario\na :: b');
		await page.getByRole('button', { name: 'Check' }).click();
		await page.getByRole('button', { name: 'Add to course' }).click();
		await expect(page.getByRole('status')).toContainText('Added 1 notes');
		await context.setOffline(false);
	});
});
