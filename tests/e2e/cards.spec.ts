import { expect, test, type Page } from '@playwright/test';

/** Phase 8.5: "See all cards", fixing a card in place, re-import duplicates, undo, fix-it prompt. */

const REPLY = `@deck Networking
@keyterms
TCP :: Transmission Control Protocol
@fact
UDP :: reliable delivery [CHECK]
@sequence Handshake
SYN
SYN-ACK
ACK
@end`;

const pasteArea = (page: Page) => page.getByLabel("Paste the chatbot's text");

async function importReply(page: Page, text = REPLY): Promise<void> {
	await pasteArea(page).fill(text);
	await page.getByRole('button', { name: 'Check' }).click();
	await page.getByRole('button', { name: 'Add to course' }).click();
	await expect(page.getByRole('status')).toContainText('Added');
}

async function newCourse(page: Page): Promise<void> {
	await page.goto('/import');
	await page.getByLabel('New course').fill('Networks');
	await page.getByRole('button', { name: 'Create course' }).click();
	await expect(page.getByRole('combobox', { name: 'Course' })).toHaveValue(/.+/);
}

const row = (page: Page, prompt: string) => page.getByRole('article', { name: prompt });
const noteIdOf = (page: Page, prompt: string) =>
	page.locator('[data-note-id]', { has: row(page, prompt) }).getAttribute('data-note-id');

test.describe('see all cards', () => {
	test('the import screen shows numbered steps', async ({ page }) => {
		await newCourse(page);
		for (const name of [
			'Choose a course',
			'Copy the prompt into your chatbot',
			'Paste its reply'
		]) {
			await expect(page.getByRole('heading', { name })).toBeVisible();
		}
	});

	test('after an import, the unsure cards open in "Check these"', async ({ page }) => {
		await newCourse(page);
		await importReply(page);
		await page.getByRole('link', { name: 'Check the unsure cards' }).click();
		await expect(page).toHaveURL(/\/cards\?filter=flagged$/);
		await expect(row(page, 'UDP')).toBeVisible();
		await expect(row(page, 'UDP').getByText('Check this')).toBeVisible();
		await expect(row(page, 'TCP')).toHaveCount(0);
	});

	test('fixes a wrong card in place, keeping its card ID', async ({ page }) => {
		await newCourse(page);
		await importReply(page);
		await page.getByRole('link', { name: 'See all cards' }).click();
		const before = await noteIdOf(page, 'UDP');
		expect(before).toMatch(/^[0-9a-f-]{36}$/);
		await row(page, 'UDP').getByRole('button', { name: 'Edit' }).click();
		await page.getByLabel('Definition').fill('*unreliable*, connectionless delivery');
		await page.getByRole('button', { name: 'Save' }).click();
		await expect(row(page, 'UDP')).toContainText('unreliable, connectionless delivery');
		await expect(row(page, 'UDP').getByText('Check this')).toHaveCount(0);
		expect(await noteIdOf(page, 'UDP')).toBe(before);
	});

	test('an invalid edit says what to fix and saves nothing', async ({ page }) => {
		await newCourse(page);
		await importReply(page);
		await page.getByRole('link', { name: 'See all cards' }).click();
		await row(page, 'Handshake').getByRole('button', { name: 'Edit' }).click();
		await page.getByLabel('Steps').fill('only one');
		await page.getByRole('button', { name: 'Save' }).click();
		await expect(page.getByRole('alert')).toHaveText('A sequence needs at least 2 steps.');
	});

	test('searches, flags, and deletes', async ({ page }) => {
		await newCourse(page);
		await importReply(page);
		await page.getByRole('link', { name: 'See all cards' }).click();
		await page.getByLabel('Search cards').fill('handshake');
		await expect(row(page, 'Handshake')).toBeVisible();
		await expect(row(page, 'TCP')).toHaveCount(0);
		await page.getByLabel('Search cards').fill('');

		await row(page, 'TCP').getByRole('button', { name: 'Looks wrong' }).click();
		await expect(row(page, 'TCP').getByText('Paused')).toBeVisible();
		await row(page, 'TCP').getByRole('button', { name: "It's fine" }).click();
		await expect(row(page, 'TCP').getByText('Paused')).toHaveCount(0);

		await row(page, 'Handshake').getByRole('button', { name: 'Delete' }).click();
		await page.locator('[data-confirm]').click();
		await expect(row(page, 'Handshake')).toHaveCount(0);
		await page.reload();
		await expect(row(page, 'TCP')).toBeVisible();
		await expect(row(page, 'Handshake')).toHaveCount(0);
	});

	test('re-importing the same text adds no duplicates', async ({ page }) => {
		await newCourse(page);
		await importReply(page);
		await page.getByRole('button', { name: 'Import more' }).click();
		await pasteArea(page).fill(REPLY);
		await page.getByRole('button', { name: 'Check' }).click();
		await expect(
			page.getByText("3 lines are already in this course, so they're left out.")
		).toBeVisible();
	});

	test('offers a fix-it prompt for skipped parts', async ({ page }) => {
		await newCourse(page);
		await pasteArea(page).fill(`@deck Networking\n@fact\nthis line is wrong\n@end`);
		await page.getByRole('button', { name: 'Check' }).click();
		await page.getByText('Show the fix-it prompt').click();
		await expect(page.getByText(/could not import these parts/)).toBeVisible();
	});

	test('the course page links to the list and back', async ({ page }) => {
		await newCourse(page);
		await importReply(page);
		await page.getByRole('link', { name: 'Start studying' }).click();
		await page.getByRole('link', { name: 'See all cards' }).click();
		await expect(row(page, 'TCP')).toBeVisible();
		await page.getByRole('link', { name: 'Back to the course' }).click();
		await expect(page).toHaveURL(/\/course\/[0-9a-f-]+$/);
	});

	test('the course page undoes the last import', async ({ page }) => {
		await newCourse(page);
		await importReply(page);
		await page.getByRole('link', { name: 'Start studying' }).click();
		await page.getByText(/^Last import:/).click();
		await page.getByRole('button', { name: 'Undo this import' }).click();
		await page.locator('[data-confirm]').click();
		await expect(page.getByRole('status')).toContainText('Import undone: 3 notes');
		await page.getByRole('link', { name: 'See all cards' }).click();
		await expect(page.getByText('This course has no cards yet.')).toBeVisible();
	});
});
