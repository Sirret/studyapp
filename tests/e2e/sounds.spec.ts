import { expect, test } from '@playwright/test';

/**
 * Phase 8.6 step 11 (SESSION_NOTES §D7; WIP "Sound toggle must be easy to find"): the speaker in
 * the Practice and study top bars mutes with one tap, the choice is saved at once, holds on
 * reload, and the Settings row shows it.
 */
test.describe('sounds', () => {
	test.use({ reducedMotion: 'reduce', actionTimeout: 10_000 });

	test('mute in a session, reload, still muted; Settings shows Sounds off', async ({ page }) => {
		test.setTimeout(120_000);
		await page.goto('/');
		await page.locator('[data-try-sample]').click();
		await page.waitForURL(/\/course\/[^/]+$/);
		await page.getByRole('link', { name: /Practice/ }).click();
		await expect(page.getByRole('heading', { name: 'Just practise' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sounds on' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		await page.locator('[data-practice-quiz]').click();
		await page.waitForURL(/\/study\//);
		const toggle = page.locator('[data-sound-toggle]');
		await expect(toggle).toHaveAccessibleName('Sounds on');
		const box = await toggle.boundingBox();
		expect(box?.width).toBeGreaterThanOrEqual(44);
		expect(box?.height).toBeGreaterThanOrEqual(44);
		await toggle.click();
		await expect(toggle).toHaveAccessibleName('Sounds off');
		await expect(toggle).toHaveAttribute('aria-pressed', 'false');

		await page.reload();
		await expect(page.locator('[data-sound-toggle]')).toHaveAccessibleName('Sounds off');

		await page.goto('/settings');
		await expect(page.getByRole('switch', { name: 'Sounds' })).not.toBeChecked();
	});
});
