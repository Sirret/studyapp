import { expect, test, type Page } from '@playwright/test';
import { playOpenSession } from './play-session.ts';

/**
 * Phase 7 (BUILD_PLAN §6.6–§6.8): a course imported as "haven't read" is learnt part by part on
 * the learn screen, and an exam date switches the course page to cram or one-night.
 */

const TEXT = `@deck Transport
@keyterms
Port :: number that names a service on a host
Packet :: unit of data sent across a network
@read
TCP is a reliable, connection-oriented transport protocol. UDP is connectionless.
@fact
TCP :: connection-oriented, reliable delivery
UDP :: connectionless, best-effort delivery
@end
`;

async function importCourse(page: Page): Promise<void> {
	await page.goto('/import');
	await page.getByLabel('New course').fill('Networks');
	await page.getByRole('button', { name: 'Create course' }).click();
	await expect(page.getByRole('combobox', { name: 'Course' })).toHaveValue(/.+/);
	await page.getByLabel("Paste the chatbot's text").fill(TEXT);
	await page.getByRole('button', { name: 'Check' }).click();
	await page.getByRole('button', { name: 'Add to course' }).click();
	await expect(page.getByRole('status')).toContainText('Added');
	await page.goto('/');
	await page
		.getByRole('article', { name: 'Networks' })
		.getByRole('link', { name: 'Plan and learn' })
		.click();
	await page.waitForURL(/\/course\//);
}

function localDate(daysAhead: number): string {
	const date = new Date();
	// Before the 04:00 rollover the study day is still yesterday's.
	if (date.getHours() < 4) date.setDate(date.getDate() - 1);
	date.setDate(date.getDate() + daysAhead);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

test.describe('modes', () => {
	test.use({ reducedMotion: 'reduce', actionTimeout: 10_000 });

	test('learns an unread part step by step, then it leaves the list', async ({ page }) => {
		test.setTimeout(240_000);
		await importCourse(page);
		await expect(page.getByRole('heading', { name: 'Learn new material' })).toBeVisible();
		const learn = page.getByRole('region', { name: 'Learn new material' });
		await learn.getByRole('link', { name: 'Start' }).first().click();
		await page.waitForURL(/\/learn\//);
		for (let guard = 0; guard < 8; guard += 1) {
			const done = page.getByRole('link', { name: 'Back to the course' });
			const read = page.locator('[data-read-done]');
			const startStep = page.locator('[data-start-step]');
			await expect(done.or(read).or(startStep).first()).toBeVisible();
			if (await done.isVisible()) break;
			if (await read.isVisible()) {
				await expect(page.locator('[data-chunk-text]')).toContainText('TCP');
				await read.click();
				continue;
			}
			await startStep.click();
			await page.waitForURL(/\/study\//);
			await playOpenSession(page);
			// Inside a unit: no round or session summary, straight back to the unit.
			await page.waitForURL(/\/learn\//);
			await expect(page.locator('[data-session-summary]')).toHaveCount(0);
		}
		// One summary, at the end of the unit.
		await expect(page.locator('[data-unit-summary]')).toContainText("You've met");
		await page.getByRole('link', { name: 'Back to the course' }).click();
		await page.waitForURL(/\/course\//);
		await expect(page.getByRole('heading', { name: 'Learn new material' })).toHaveCount(0);
	});

	test('an exam date switches the course to cram, and tomorrow to one-night', async ({ page }) => {
		await importCourse(page);
		await expect(page.getByRole('heading', { name: 'Long-term review' })).toBeVisible();
		await page.locator('[data-exam-date]').fill(localDate(3));
		await page.locator('[data-save-exam]').click();
		await expect(page.getByRole('heading', { name: 'Cram · 3 days to the exam' })).toBeVisible();
		await page.locator('[data-exam-date]').fill(localDate(1));
		await page.locator('[data-save-exam]').click();
		await expect(page.getByRole('heading', { name: 'One-night triage' })).toBeVisible();
		// Nothing learnt tonight yet: no dead button, a line saying when the re-quiz opens.
		await expect(page.locator('[data-block-two]')).toHaveCount(0);
		await expect(page.locator('[data-block-two-waiting]')).toBeVisible();
		await expect(page.locator('[data-minimum-block]')).toHaveCount(0);
	});

	test('one-night with no study time left still plans a short block, with the sleep reminder', async ({
		page
	}) => {
		await importCourse(page);
		const course = page.url();
		await page.locator('[data-exam-date]').fill(localDate(1));
		await page.locator('[data-save-exam]').click();
		await expect(page.getByRole('heading', { name: 'One-night triage' })).toBeVisible();
		await page.goto('/planner');
		for (let day = 0; day < 7; day += 1) await page.locator(`[data-weekday="${day}"]`).fill('0');
		await page.getByLabel('Exam-morning top-up (min)').fill('0');
		await page.locator('[data-save-availability]').click();
		await expect(page.locator('[data-short="Networks"]')).toBeVisible();
		await page.goto(course);
		await expect(page.getByRole('heading', { name: 'One-night triage' })).toBeVisible();
		await expect(page.locator('[data-minimum-block]')).toContainText('Then sleep');
		await expect(page.getByRole('link', { name: 'Start' }).first()).toBeVisible();
	});
});
