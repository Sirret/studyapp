import { expect, test } from '@playwright/test';

/**
 * Visual regression of the style guide (CLAUDE.md rule 13: "Keep the screenshot check"; DESIGN
 * §13.4). One screenshot per guide section, each showing its components in the light and the
 * lamp-light theme. Runs on the mobile viewport only (360 px, the priority width).
 *
 * Baselines are per OS (fonts render differently): the Windows ones are committed; on CI a missing
 * baseline is written instead of failing (`updateSnapshots: 'missing'` in playwright.config.ts).
 * After a deliberate visual change, refresh them with `npx playwright test visual --update-snapshots`.
 */

const SECTIONS = [
	'tokens',
	'primitives',
	'components',
	'cozy-components',
	'study-flow',
	'card-list',
	'figures',
	'yuki',
	'delight',
	'layout'
] as const;

test.describe('style guide visuals', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/dev/ui');
		await expect(page.locator('[data-guide-section="layout"]')).toBeVisible();
		await page.evaluate(() => document.fonts.ready);
	});

	test('every guide section is listed here', async ({ page }) => {
		const ids = await page
			.locator('[data-guide-section]')
			.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-guide-section')));
		expect(ids.sort()).toEqual([...SECTIONS].sort());
	});

	for (const id of SECTIONS) {
		test(`section ${id} looks the same`, async ({ page }) => {
			// A full-page shot clipped to the section, from the top: the same whole-pixel box every
			// run (an element shot scrolls first, and a fractional scroll shifts text by a sub-pixel).
			await page.evaluate(() => window.scrollTo(0, 0));
			const box = await page.locator(`[data-guide-section="${id}"]`).boundingBox();
			expect(box).not.toBeNull();
			const y = Math.floor(box!.y);
			const clip = {
				x: 0,
				y,
				width: page.viewportSize()!.width,
				height: Math.ceil(box!.y + box!.height) - y
			};
			await expect(page).toHaveScreenshot(`${id}.png`, { fullPage: true, clip });
		});
	}
});
