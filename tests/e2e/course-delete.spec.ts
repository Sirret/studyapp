import { expect, test } from '@playwright/test';

/**
 * Deleting a course lives on its own page, behind a Sheet that names the course and what is lost;
 * the Shelf has no delete button (Decisions "UX fix: delete from the course page").
 */
test.describe('course delete', () => {
	test.use({ reducedMotion: 'reduce' });

	test('the shelf has no delete; the course page asks first, keeps on cancel, deletes on confirm', async ({
		page
	}) => {
		await page.goto('/');
		await page.locator('[data-try-sample]').click();
		await page.waitForURL(/\/course\/[0-9a-f-]+$/, { timeout: 30000 });
		const coursePage = page.url();

		await page.goto('/courses');
		const card = page.getByRole('article').first();
		await expect(card).toBeVisible();
		const name = (await card.getAttribute('aria-label')) ?? '';
		expect(name).not.toBe('');
		await expect(card.getByRole('button', { name: /delete/i })).toHaveCount(0);

		await page.goto(coursePage);
		await page.locator('[data-delete-course]').click();
		const sheet = page.getByRole('dialog', { name: `Delete ${name}?` });
		await expect(sheet).toBeVisible();
		await expect(sheet.locator('[data-delete-what]')).toContainText(name);
		await expect(sheet.locator('[data-delete-what]')).toContainText(/\d+ cards?/);
		await expect(sheet.locator('[data-delete-what]')).toContainText('study history');
		await sheet.getByRole('button', { name: 'Keep the course' }).click();
		await expect(sheet).toBeHidden();
		await page.goto('/courses');
		await expect(page.getByRole('article', { name })).toBeVisible();

		await page.goto(coursePage);
		await page.locator('[data-delete-course]').click();
		await page.locator('[data-delete-confirm]').click();
		await page.waitForURL(/\/courses$/);
		await expect(page.getByRole('article', { name })).toHaveCount(0);
	});
});
