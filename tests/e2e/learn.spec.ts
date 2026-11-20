import { expect, test } from '@playwright/test';
import { openLearnCourse } from './learn-course.ts';
import { playOpenSession } from './play-session.ts';

/**
 * Phase 8.6 Learn (SESSION_NOTES C; Decisions log "Phase 8.6 Q2", "Q3", "Q6", "Q7"): from the
 * course page's Learn door, a topic runs summary → meet the terms → read with the tip → questions
 * → … → mixed quiz → summary → topic done, with no session summaries in between, and its sections
 * then count as read on the course page.
 */
test.describe('learn', () => {
	test.use({ reducedMotion: 'reduce', actionTimeout: 10_000 });

	test('a topic runs screen by screen to "Topic done", then its sections count as read', async ({
		page
	}) => {
		test.setTimeout(240_000);
		await openLearnCourse(page);
		await expect(page.locator('[data-topics-read]')).toHaveText('0 of 5 read');
		await page.getByRole('link', { name: /Learn/ }).click();
		await expect(page.getByRole('heading', { name: 'Pick a topic' })).toBeVisible();
		await page.getByRole('button', { name: /Security/ }).click();

		const seen: string[] = [];
		const screen = page.locator('[data-learn-screen]');
		const done = page.locator('[data-topic-done]');
		for (let guard = 0; guard < 20; guard += 1) {
			await expect(screen.or(done).first()).toBeVisible();
			if (await done.isVisible()) break;
			const step = (await screen.getAttribute('data-learn-screen')) ?? '';
			seen.push(step);
			if (step === 'read' && seen.filter((s) => s === 'read').length === 1) {
				await expect(page.getByText('Lock and key.')).toBeVisible();
			}
			const meet = page.locator('[data-meet-start]');
			const start = page.locator('[data-learn-start]');
			const before = page.url();
			if (await meet.isVisible()) await meet.click();
			else if (await start.isVisible()) await start.click();
			else await page.locator('[data-learn-next]').click();
			// Every step changes the URL; a session step opens /study and comes straight back.
			await expect.poll(() => page.url()).not.toBe(before);
			if (/\/study\//.test(page.url())) {
				await playOpenSession(page);
				await page.waitForURL(/\/learn\?/);
				await expect(page.locator('[data-session-summary]')).toHaveCount(0);
			}
		}
		expect(seen[0]).toBe('summary');
		expect(seen).toContain('meetTerms');
		expect(seen.filter((s) => s === 'read')).toHaveLength(2);
		expect(seen.at(-1)).toBe('summary');
		await expect(done).toContainText('Security');
		await expect(page.locator('[data-next-topic]')).toContainText('Networks');

		await page.getByRole('link', { name: 'Back to the course' }).click();
		await expect(page.locator('[data-topics-read]')).toHaveText('2 of 5 read');
	});

	test('the course page has four doors, Play disabled, and opens Exam prep', async ({ page }) => {
		await openLearnCourse(page);
		await expect(page.getByRole('button', { name: /Play/ })).toBeDisabled();
		await expect(page.getByRole('link', { name: /Learn/ })).toContainText('5 sections to read');
		await page.getByRole('link', { name: /Exam prep/ }).click();
		await expect(page).toHaveURL(/\/exam$/);
		await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
		await expect(page.locator('[data-exam-date]')).toBeVisible();
	});
});
