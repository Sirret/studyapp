import { expect, test } from '@playwright/test';
import { openLearnCourse } from './learn-course.ts';

/**
 * Phase 8.6 "pick, then mode" (SESSION_NOTES J; Decisions log "Phase 8.6 Q12"): the scope picked on
 * the course page is stored per course, survives a reload, narrows Learn and the topic list, shows
 * on Exam prep, and "Study all" brings the whole course back.
 */
test.describe('scope', () => {
	test.use({ reducedMotion: 'reduce', actionTimeout: 10_000 });

	test('studying one topic narrows Learn and Exam prep, and "Study all" undoes it', async ({
		page
	}) => {
		await openLearnCourse(page);
		const line = page.locator('[data-scope-line]');
		await expect(line).toContainText('Studying everything');

		await page.locator('[data-scope-change]').click();
		const sheet = page.getByRole('dialog', { name: 'Pick what to study' });
		await sheet.locator('label', { hasText: 'Networks' }).click();
		await expect(sheet.locator('[data-scope-picker]')).toContainText('Studying 1 of 2 topics');
		await sheet.locator('[data-scope-save]').click();
		await expect(sheet).toBeHidden();

		await expect(line).toContainText('Studying 1 of 2 topics');
		await expect(page.getByRole('link', { name: /Learn/ })).toContainText('2 sections to read');
		await expect(page.locator('[data-topic-row]')).toHaveCount(1);
		await page.reload();
		await expect(line).toContainText('Studying 1 of 2 topics');

		await page.getByRole('link', { name: /Learn/ }).click();
		await expect(page.getByRole('button', { name: /Security/ })).toBeVisible();
		await expect(page.getByRole('button', { name: /Networks/ })).toHaveCount(0);
		await page.getByRole('link', { name: 'Course page' }).click();

		await page.getByRole('link', { name: /Exam prep/ }).click();
		await expect(page.locator('[data-exam-scope]')).toContainText('Planning 1 of 2 topics');
		await page.getByRole('link', { name: 'Course page' }).click();

		await page.locator('[data-scope-change]').click();
		await sheet.locator('label', { hasText: 'Study all' }).click();
		await sheet.locator('[data-scope-save]').click();
		await expect(line).toContainText('Studying everything');
		await expect(page.locator('[data-topic-row]')).toHaveCount(2);
	});

	test('nothing picked cannot be saved', async ({ page }) => {
		await openLearnCourse(page);
		await page.locator('[data-scope-change]').click();
		const sheet = page.getByRole('dialog', { name: 'Pick what to study' });
		await sheet.locator('label', { hasText: 'Study all' }).click();
		await expect(sheet.locator('[data-scope-save]')).toBeDisabled();
		await expect(sheet.getByText('Pick at least one section.')).toBeVisible();
	});
});
