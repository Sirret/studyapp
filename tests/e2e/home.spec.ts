import { expect, test, type Page } from '@playwright/test';
import { openLearnCourse } from './learn-course.ts';
import { playOpenSession } from './play-session.ts';

/** Steps through the Security topic in Learn until one session step has been answered. */
async function answerOneLearnStep(page: Page): Promise<void> {
	await page.getByRole('link', { name: /Learn/ }).click();
	await page.getByRole('button', { name: /Security/ }).click();
	for (let guard = 0; guard < 10; guard += 1) {
		await expect(page.locator('[data-learn-screen]')).toBeVisible();
		const meet = page.locator('[data-meet-start]');
		const start = page.locator('[data-learn-start]');
		const before = page.url();
		if (await meet.isVisible()) await meet.click();
		else if (await start.isVisible()) await start.click();
		else await page.locator('[data-learn-next]').click();
		await expect.poll(() => page.url()).not.toBe(before);
		if (/\/study\//.test(page.url())) {
			await playOpenSession(page);
			await page.waitForURL(/\/learn\?/);
			return;
		}
	}
	throw new Error('no session step in the Security topic');
}

/**
 * Phase 8.6 step 10 (SESSION_NOTES §K; Decisions log "Phase 8.6 Q17"): Welcome whenever there are
 * no courses, with its three ways in; the returning Home continues where the student left off.
 */
test.describe('home', () => {
	test.use({ reducedMotion: 'reduce', actionTimeout: 10_000 });

	test('Welcome: Yuki, how it works, the sample first, then lectures and by hand', async ({
		page
	}) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Welcome.' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'How it works' }).locator('li')).toHaveCount(3);
		const actions = page
			.getByRole('main')
			.locator('button, a')
			.filter({ hasText: /Try a sample course|Bring my lectures|Make cards by hand/ });
		await expect(actions).toHaveText([
			/Try a sample course/,
			/Bring my lectures/,
			/Make cards by hand/
		]);
		// No streak copy anywhere (SESSION_NOTES §K).
		await expect(page.getByText(/streak/i)).toHaveCount(0);
		await page.getByRole('link', { name: 'Bring my lectures' }).click();
		await expect(page).toHaveURL(/\/import$/);
	});

	test('after a Learn step, Home continues that topic; the Shelf lists the course', async ({
		page
	}) => {
		test.setTimeout(180_000);
		await openLearnCourse(page);
		await answerOneLearnStep(page);

		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
		await expect(page.locator('[data-left-off="Security"]')).toBeVisible();
		await expect(page.getByRole('region', { name: 'Where you left off' })).toContainText(
			'Security and Networks · Learn'
		);
		await expect(page.locator('[data-shelf-course="Security and Networks"]')).toContainText(
			'2 topics'
		);
		await expect(page.getByText(/streak/i)).toHaveCount(0);

		await page.locator('[data-continue]').click();
		await expect(page).toHaveURL(/\/learn\?topic=/);
		await expect(page.locator('[data-learn-screen]')).toBeVisible();

		await page.goto('/');
		await page
			.getByRole('navigation', { name: 'Main' })
			.getByRole('link', { name: 'Shelf' })
			.click();
		await expect(page).toHaveURL(/\/courses$/);
		await expect(page.locator('[data-reading="Security and Networks"]')).toContainText(
			/2 topics · \d of 5 read/
		);
	});
});
