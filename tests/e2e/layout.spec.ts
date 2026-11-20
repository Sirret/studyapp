import { expect, test, type Locator, type Page } from '@playwright/test';
import { openLearnCourse } from './learn-course.ts';

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
		await expectWithinWidth(
			page,
			page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Import notes' })
		);
		await expectNoSidewaysScroll(page);
	});

	test('one main nav: the Sidebar from 1024 px, else the BottomNav (DESIGN §10)', async ({
		page
	}) => {
		await page.goto('/');
		const desktop = (page.viewportSize()?.width ?? 0) >= 1024;
		const nav = page.getByRole('navigation', { name: 'Main' });
		await expect(nav).toHaveCount(1);
		await expect(nav.getByRole('link', { name: 'Den' })).toHaveAttribute('aria-current', 'page');
		const box = await nav.boundingBox();
		const main = await page.getByRole('main').boundingBox();
		expect(box).not.toBeNull();
		expect(main).not.toBeNull();
		// Desktop: a column left of the content. Mobile: a bar along the window's bottom edge.
		if (desktop) expect(box!.x + box!.width).toBeLessThanOrEqual(main!.x);
		else expect(box!.y + box!.height).toBeCloseTo(page.viewportSize()?.height ?? 0, 0);
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

	test('the course doors, the scope sheet and the Learn reader fit', async ({ page }) => {
		// An import and four screens: longer than the 30 s default on the slow laptop.
		test.setTimeout(90_000);
		await openLearnCourse(page);
		await expectWithinWidth(page, page.getByRole('button', { name: /Play/ }));
		await expectNoSidewaysScroll(page);
		await page.locator('[data-scope-change]').click();
		await expectWithinWidth(page, page.locator('[data-scope-save]'));
		await expectNoSidewaysScroll(page);
		await page.keyboard.press('Escape');
		await page.getByRole('link', { name: /Learn/ }).click();
		await page.getByRole('button', { name: /Security/ }).click();
		await page.locator('[data-learn-next]').click();
		await expect(page.locator('[data-learn-screen="meetTerms"]')).toBeVisible();
		await expectWithinWidth(page, page.locator('[data-meet-start]'));
		await expectNoSidewaysScroll(page);
		await page.goto(page.url().replace(/step=\d+/, 'step=2'));
		await expect(page.locator('[data-learn-screen="read"]')).toBeVisible();
		await expectWithinWidth(page, page.locator('[data-learn-next]'));
		await expectNoSidewaysScroll(page);
	});

	test('the Practice menu and its flashcard deck fit', async ({ page }) => {
		test.setTimeout(90_000);
		await openLearnCourse(page);
		await page.getByRole('link', { name: /Practice/ }).click();
		await expectWithinWidth(page, page.locator('[data-practice-quiz]'));
		await expectNoSidewaysScroll(page);
		await page.locator('[data-practice-deck]').click();
		await expectWithinWidth(page, page.locator('[data-deck-know]'));
		await expectWithinWidth(page, page.locator('[data-deck-learning]'));
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
