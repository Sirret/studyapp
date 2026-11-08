import { expect, test, type Page } from '@playwright/test';
import { SAMPLE_KINDS } from '../../src/lib/services/dev-sample.ts';

/**
 * Phase 5 done-when (BUILD_PLAN §10): complete a session on a mobile viewport using each exercise
 * kind, with reduced motion on and off. The harness session (`/dev/session`) shows every
 * non-diagram kind; this test reads the current spec from the dev hook and answers it through the
 * real controls, as a student who knows everything would.
 */

type Spec = {
	kind: string;
	shape: string;
	answer?: string;
	correctIndex?: number;
	correct?: number[];
	correctOrder?: number[];
	pairs?: number[];
	bucketOf?: number[];
	checklist?: unknown[];
};

const MAX_STEPS = 200;

/** The page bumps a counter each time it shows a new view (dev builds only). */
const stepOf = (page: Page) =>
	page.evaluate(() => (window as unknown as { __snowpackStep?: number }).__snowpackStep ?? 0);

/** Waits until the page has moved on from the view it showed at `before`. */
async function nextView(page: Page, before: number): Promise<void> {
	await expect.poll(() => stepOf(page)).toBeGreaterThan(before);
}

async function answer(page: Page, spec: Spec): Promise<void> {
	const tap = (selector: string) => page.locator(`${selector} button`).first().click();
	switch (spec.shape) {
		case 'type':
			await page.locator('[data-exercise-input]').fill(spec.answer ?? '');
			break;
		case 'choose':
			await tap(`[data-option-index="${spec.correctIndex}"]`);
			break;
		case 'chooseMany':
			for (const i of spec.correct ?? []) await tap(`[data-option-index="${i}"]`);
			break;
		case 'order':
			for (const i of spec.correctOrder ?? []) await tap(`[data-item-index="${i}"]`);
			break;
		case 'pair':
			for (const [left, right] of (spec.pairs ?? []).entries()) {
				await tap(`[data-item-index="${right}"]`);
				await tap(`[data-slot-index="${left}"]`);
			}
			break;
		case 'sort':
			for (const [item, bucket] of (spec.bucketOf ?? []).entries()) {
				await tap(`[data-item-index="${item}"]`);
				await tap(`[data-slot-index="${bucket}"]`);
			}
			break;
		case 'selfRate':
			await page.locator('button[data-reveal]').click();
			for (const [i] of (spec.checklist ?? []).entries()) {
				await page.locator(`[data-check-index="${i}"] label`).click();
			}
			if (spec.kind === 'flip') await page.locator('button[data-rating="good"]').click();
			break;
		default:
			break;
	}
}

async function playSession(page: Page): Promise<Set<string>> {
	const seen = new Set<string>();
	await page.goto('/dev/session');
	await page.locator('button[data-start-sample]').click();
	await page.waitForURL(/\/study\//);
	const check = page.locator('button[data-check]');
	const summary = page.locator('[data-session-summary]');
	const round = page.locator('[data-round-summary]');
	const interstitial = page.locator('[data-interstitial]');
	for (let step = 0; step < MAX_STEPS; step += 1) {
		await expect(check.or(summary).or(round).or(interstitial).first()).toBeVisible();
		if (await summary.isVisible()) return seen;
		const before = await stepOf(page);
		if (await round.isVisible()) {
			await round.getByRole('button', { name: 'Continue' }).click();
			await nextView(page, before);
			continue;
		}
		if (await interstitial.isVisible()) {
			// It also leaves by itself after a moment, so it may be gone before the tap lands.
			await interstitial.click({ timeout: 2000 }).catch(() => undefined);
			continue;
		}
		const spec = (await page.evaluate(
			() => (window as unknown as { __snowpackExercise: unknown }).__snowpackExercise
		)) as Spec;
		seen.add(spec.kind);
		await answer(page, spec);
		await expect(check).toBeEnabled();
		await check.click();
		if (spec.shape !== 'selfRate' && spec.shape !== 'study') {
			await expect(page.locator('[data-feedback="correct"]')).toBeVisible();
			await page.locator('button[data-next]').click();
		}
		await nextView(page, before);
	}
	throw new Error(`The session did not end within ${MAX_STEPS} steps`);
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
