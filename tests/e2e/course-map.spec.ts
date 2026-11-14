import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const SAMPLE_NAME = 'Sample: Network security';
const REPLY = readFileSync(
	new URL('../fixtures/import/security_reply.txt', import.meta.url),
	'utf8'
);

const pasteArea = (page: Page) => page.getByLabel("Paste the chatbot's text");

test.describe('sample course and course map', () => {
	test('a first visit adds the sample course once, and it opens with its course map', async ({
		page
	}) => {
		await page.goto('/');
		// The sample is added in the background after the plan shows. Under two parallel workers on
		// the laptop it can take several seconds, so this waits longer than the default 5 s.
		await expect(page.getByText(SAMPLE_NAME)).toBeVisible({ timeout: 30000 });
		await page.reload();
		await expect(page.getByText(SAMPLE_NAME)).toHaveCount(1);

		await page.getByRole('link', { name: 'Plan and learn' }).click();
		await expect(page.getByRole('heading', { name: 'How it connects' })).toBeVisible();
		await expect(
			page.getByRole('heading', { name: 'Questions to be able to answer' })
		).toBeVisible();
		await expect(page.getByRole('table')).toBeVisible();
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
