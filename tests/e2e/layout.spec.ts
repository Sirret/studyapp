import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Layout on both viewports (Decisions log: e2e viewport split). Functional tests run on mobile
 * only; these `@both` tests run on mobile and laptop and check what differs by width: no sideways
 * scroll, and each screen's main action on screen and not cut off.
 */

const REPLY = `@deck Networking
@keyterms
TCP :: Transmission Control Protocol
@fact
UDP :: connectionless delivery [CHECK]
@end`;

async function expectNoSidewaysScroll(page: Page): Promise<void> {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
}

/** The element is visible and lies inside the window's width (not cut off at either side). */
async function expectWithinWidth(page: Page, target: Locator): Promise<void> {
	await expect(target).toBeVisible();
	const box = await target.boundingBox();
	const width = page.viewportSize()?.width ?? 0;
	expect(box).not.toBeNull();
	expect(box!.x).toBeGreaterThanOrEqual(0);
	expect(box!.x + box!.width).toBeLessThanOrEqual(width + 0.5);
}

/** A course with two cards, opened on its course page. */
async function courseWithCards(page: Page): Promise<void> {
	await page.goto('/import');
	await page.getByLabel('New course').fill('Networks');
	await page.getByRole('button', { name: 'Create course' }).click();
	await expect(page.getByRole('combobox', { name: 'Course' })).toHaveValue(/.+/);
	await page.getByLabel("Paste the chatbot's text").fill(REPLY);
	await page.getByRole('button', { name: 'Check' }).click();
	await page.getByRole('button', { name: 'Add to course' }).click();
	await page.getByRole('link', { name: 'Start studying' }).click();
	await expect(page).toHaveURL(/\/course\/[0-9a-f-]+$/);
}

test.describe('layout', { tag: '@both' }, () => {
	test('Today fits', async ({ page }) => {
		await page.goto('/');
		await expectWithinWidth(page, page.getByRole('link', { name: /import/i }).first());
		await expectNoSidewaysScroll(page);
	});

	test('Import fits, with its preview', async ({ page }) => {
		await page.goto('/import');
		await page.getByLabel('New course').fill('Networks');
		await page.getByRole('button', { name: 'Create course' }).click();
		await page.getByLabel("Paste the chatbot's text").fill(REPLY);
		await page.getByRole('button', { name: 'Check' }).click();
		await expect(page.getByRole('region', { name: 'Preview' })).toBeVisible();
		await expectWithinWidth(page, page.getByRole('button', { name: 'Add to course' }));
		await expectNoSidewaysScroll(page);
	});

	test('Plan fits', async ({ page }) => {
		await page.goto('/planner');
		await expect(page.locator('[aria-label="Your study time"]')).toBeVisible();
		await expectNoSidewaysScroll(page);
	});

	test('the course page and All cards fit', async ({ page }) => {
		await courseWithCards(page);
		await expectWithinWidth(page, page.getByRole('link', { name: 'See all cards' }));
		await expectNoSidewaysScroll(page);
		await page.getByRole('link', { name: 'See all cards' }).click();
		const row = page.getByRole('article', { name: 'UDP' });
		await expect(row).toBeVisible();
		await expectWithinWidth(page, row.getByRole('button', { name: 'Delete' }));
		await row.getByRole('button', { name: 'Edit' }).click();
		await expectWithinWidth(page, page.getByRole('button', { name: 'Save' }));
		await expectNoSidewaysScroll(page);
	});

	test('a study session fits, its action in reach', async ({ page }) => {
		await page.goto('/dev/session');
		await page.locator('button[data-start-sample]').click();
		await page.waitForURL(/\/study\//);
		await expectWithinWidth(
			page,
			page.locator('[data-check], [data-next], [data-session-continue]').first()
		);
		await expectNoSidewaysScroll(page);
	});

	test('the style guide (every component) fits', async ({ page }) => {
		await page.goto('/dev/ui');
		await expect(page.getByRole('heading', { name: 'Card list and import fixes' })).toBeVisible();
		await expectNoSidewaysScroll(page);
	});
});
