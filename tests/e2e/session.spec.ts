import { expect, test, type Page } from '@playwright/test';
import { playOpenSession } from './play-session.ts';
import { SAMPLE_KINDS } from '../../src/lib/services/dev-sample.ts';

/**
 * Phase 5 done-when (BUILD_PLAN §10): complete a session on a mobile viewport using each exercise
 * kind, with reduced motion on and off. The harness session (`/dev/session`) shows every
 * non-diagram kind; this test reads the current spec from the dev hook and answers it through the
 * real controls, as a student who knows everything would.
 */

async function playSession(page: Page): Promise<Set<string>> {
	await page.goto('/dev/session');
	await page.locator('button[data-start-sample]').click();
	await page.waitForURL(/\/study\//);
	return playOpenSession(page);
}

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
	test.describe(`study session, reduced motion ${reducedMotion}`, () => {
		test.use({ reducedMotion, actionTimeout: 10_000 });

		test('completes a session that uses every non-diagram exercise kind', async ({
			page
		}, info) => {
			test.skip(info.project.name !== 'mobile', 'The done-when asks for the mobile viewport');
			// About 45 steps through every exercise kind; animations add a little to each.
			test.setTimeout(300_000);
			const seen = await playSession(page);
			expect(SAMPLE_KINDS.filter((kind) => !seen.has(kind))).toStrictEqual([]);
			await expect(page.locator('[data-session-summary]')).toContainText('Session done');
		});
	});
}
