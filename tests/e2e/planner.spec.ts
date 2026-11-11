import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 8 (BUILD_PLAN §6.9): two courses with exam dates share Today's minutes; the Plan screen
 * shows the days and each exam's feasibility, and setting no study time flags a shortfall.
 */

const text = (name: string): string => `@deck ${name}
@keyterms
${name} port :: number that names a service on a host
${name} packet :: unit of data sent across a network
@read
${name} is about reliable delivery with a handshake and acknowledgements.
@fact
${name} TCP :: connection-oriented, reliable delivery
@end
`;

function localDate(daysAhead: number): string {
	const date = new Date();
	// Before the 04:00 rollover the study day is still yesterday's.
	if (date.getHours() < 4) date.setDate(date.getDate() - 1);
	date.setDate(date.getDate() + daysAhead);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Imports a course and sets its exam `days` ahead from its course page. */
async function courseWithExam(page: Page, name: string, days: number): Promise<void> {
	await page.goto('/import');
	await page.getByLabel('New course').fill(name);
	await page.getByRole('button', { name: 'Create course' }).click();
	await expect(page.getByRole('combobox', { name: 'Course' })).toHaveValue(/.+/);
	await page.getByLabel("Paste the chatbot's text").fill(text(name));
	await page.getByRole('button', { name: 'Check' }).click();
	await page.getByRole('button', { name: 'Add to course' }).click();
	await expect(page.getByRole('status')).toContainText('Added');
	await page.goto('/');
	await page.getByRole('article', { name }).getByRole('link', { name: 'Plan and learn' }).click();
	await page.waitForURL(/\/course\//);
	await page.locator('[data-exam-date]').fill(localDate(days));
	await page.locator('[data-save-exam]').click();
	await expect(page.getByText(`${days} days to go`)).toBeVisible();
}

test.describe('planner', () => {
	test.use({ reducedMotion: 'reduce', actionTimeout: 10_000 });

	test('shares today across exams, then flags a shortfall when no time is set', async ({
		page
	}) => {
		test.setTimeout(180_000);
		await courseWithExam(page, 'Networks', 3);
		await courseWithExam(page, 'Databases', 5);

		await page.goto('/');
		for (const name of ['Networks', 'Databases']) {
			await expect(page.locator(`[data-planned="${name}"]`)).toContainText(/\d+ min today/);
		}
		await expect(page.getByRole('note')).toHaveCount(0);

		await page.getByRole('link', { name: 'Plan and availability' }).click();
		await page.waitForURL(/\/planner/);
		await expect(page.getByRole('group', { name: /^Today:/ })).toBeVisible();
		await expect(page.locator('[data-fits="Networks"]')).toBeVisible();
		await expect(page.locator('[data-fits="Databases"]')).toBeVisible();

		for (let day = 0; day < 7; day += 1) await page.locator(`[data-weekday="${day}"]`).fill('0');
		await page.getByLabel('Exam-morning top-up (min)').fill('0');
		await page.locator('[data-save-availability]').click();
		await expect(page.locator('[data-short="Networks"]')).toBeVisible();

		await page.getByRole('link', { name: 'Back to Today' }).last().click();
		await expect(page.getByRole('note')).toContainText(
			"Not everything fits before Networks's exam"
		);
	});
});
