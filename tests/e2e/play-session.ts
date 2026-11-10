import { expect, type Page } from '@playwright/test';

/**
 * Plays a study session through the real controls, as a student who knows everything: reads the
 * current spec from the dev hook (`window.__snowpackExercise`) and answers it. Shared by the e2e
 * specs that run sessions.
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

/** Answers the open session until its summary shows; returns the kinds seen. */
export async function playOpenSession(page: Page): Promise<Set<string>> {
	const seen = new Set<string>();
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
