import { expect, test } from '@playwright/test';

/**
 * Phase 8.6 step 10 (DESIGN §12 "Settings"): the gear in Home's TopBar opens Settings; each change
 * saves at once and holds on reload. The dark theme is called Lamp-light; music stays hidden.
 */
test.describe('settings', () => {
	test.use({ reducedMotion: 'reduce' });

	test('theme, sounds and spelling save at once and survive a reload', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: 'Settings' }).click();
		await expect(page).toHaveURL(/\/settings$/);
		await expect(page.getByText(/music/i)).toHaveCount(0);

		await page.getByLabel('Theme').selectOption({ label: 'Lamp-light (dark)' });
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		// The Toggle's track covers its checkbox, so tap the row (its label), as a student would.
		await page.locator('label', { hasText: 'Sounds' }).click();
		await expect(page.getByRole('switch', { name: 'Sounds' })).not.toBeChecked();
		await page.getByRole('button', { name: 'Word bank' }).click();
		await page.getByRole('button', { name: 'Quiet' }).click();
		await expect(page.locator('html')).toHaveAttribute('data-companion', 'quiet');

		await page.reload();
		await expect(page.getByLabel('Theme')).toHaveValue('dark');
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await expect(page.getByRole('switch', { name: 'Sounds' })).not.toBeChecked();
		await expect(page.getByRole('button', { name: 'Word bank' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(page.getByRole('button', { name: 'Quiet' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});
});
