import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const SAMPLE_NAME = 'Sample: Network security';
const REPLY = readFileSync(
	new URL('../fixtures/import/security_reply.txt', import.meta.url),
	'utf8'
);

const pasteArea = (page: Page) => page.getByLabel("Paste the chatbot's text");

test.describe('sample course and course map', () => {
	test('Welcome adds the sample course on tap, once, and it opens with its course map', async ({
		page
	}) => {
		await page.goto('/');
		// Phase 8.6 Q17: nothing is added until the student taps.
		await expect(page.getByRole('heading', { name: 'Welcome.' })).toBeVisible();
		await page.locator('[data-try-sample]').click();
		await page.waitForURL(/\/course\/[0-9a-f-]+$/, { timeout: 30000 });
		await expect(page.getByRole('heading', { name: 'How it connects' })).toBeVisible();
		await expect(
			page.getByRole('heading', { name: 'Questions to be able to answer' })
		).toBeVisible();
		await expect(page.getByRole('table')).toBeVisible();

		await page.goto('/');
		await expect(page.locator(`[data-shelf-course="${SAMPLE_NAME}"]`)).toBeVisible();
		await page.reload();
		await expect(page.locator(`[data-shelf-course="${SAMPLE_NAME}"]`)).toHaveCount(1);
	});

	test('a partly pasted reply shows the checklist and the resume prompt', async ({ page }) => {
		await page.goto('/import');
		await page.getByLabel('New course').fill('Networks');
		await page.getByRole('button', { name: 'Create course' }).click();
		await pasteArea(page).fill(REPLY.slice(0, Math.floor(REPLY.length / 2)));
		await page.getByRole('button', { name: 'Check' }).click();
		await expect(page.getByRole('heading', { name: /\d+ of \d+ topics imported/ })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Copy the resume prompt' })).toBeVisible();
	});
});
