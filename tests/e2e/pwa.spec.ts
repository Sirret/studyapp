import { expect, test, type Page } from '@playwright/test';
import { APP_NAME, APP_SHORT_NAME } from '../../src/lib/config/defaults.ts';

async function waitForServiceWorker(page: Page): Promise<void> {
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
}

test.describe('app shell', () => {
	test('shows the app name with no sideways scroll', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { name: APP_NAME })).toBeVisible();
		await expect(page).toHaveTitle(APP_NAME);
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBe(0);
	});
});

test.describe('PWA install', () => {
	test('the manifest has what Android needs to install the app', async ({ page, request }) => {
		await page.goto('/');
		const href = await page.locator('link[rel="manifest"]').getAttribute('href');
		expect(href).toBeTruthy();

		const manifest = await (await request.get(href ?? '')).json();
		expect(manifest.name).toBe(APP_NAME);
		expect(manifest.short_name).toBe(APP_SHORT_NAME);
		expect(manifest.display).toBe('standalone');
		expect(manifest.start_url).toBe('/');

		const icons: { src: string; sizes: string; purpose: string }[] = manifest.icons;
		for (const size of ['192x192', '512x512']) {
			expect(icons.some((icon) => icon.sizes === size && icon.purpose === 'any')).toBe(true);
		}
		expect(icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
		for (const icon of icons) {
			const response = await request.get(icon.src);
			expect(response.status(), icon.src).toBe(200);
			expect(response.headers()['content-type']).toContain('image/png');
		}
	});

	test('Chromium parses the manifest without errors', async ({ page, context }) => {
		await page.goto('/');
		const cdp = await context.newCDPSession(page);
		const { errors } = await cdp.send('Page.getAppManifest');
		expect(errors).toEqual([]);
	});
});

test.describe('offline', () => {
	test('reopens the shell with the network off', async ({ page, context }) => {
		await page.goto('/');
		await waitForServiceWorker(page);

		await context.setOffline(true);
		await page.reload();

		await expect(page.getByRole('heading', { name: APP_NAME })).toBeVisible();
	});

	test('serves the SPA fallback for a deep link with the network off', async ({
		page,
		context
	}) => {
		await page.goto('/');
		await waitForServiceWorker(page);

		await context.setOffline(true);
		const response = await page.goto('/some/deep/link');

		expect(response?.fromServiceWorker()).toBe(true);
		expect(response?.status()).toBe(200);
		// The app itself booted and its router handled the unknown route.
		await expect(page).toHaveTitle(APP_NAME);
		await expect(page.locator('body')).toContainText('404');
	});
});
