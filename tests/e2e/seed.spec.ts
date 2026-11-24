import { expect, test, type Page } from '@playwright/test';
import { readTable } from './idb.ts';

/**
 * `/dev/seed` (test builds only): the Rich seed makes six courses with pictures, diagrams, exam
 * dates and past study history; Shelf stress makes fifty; Wipe empties the local database.
 *
 * @see Decisions log "Pre-review step: /dev/seed"
 */
test.describe('dev seed', () => {
	test.use({ reducedMotion: 'reduce' });

	async function wipe(page: Page): Promise<void> {
		await page.goto('/dev/seed');
		await page.locator('[data-wipe]').click();
		await expect(page.locator('[data-seed-status]')).toHaveText('Local database wiped.');
	}

	test('Rich seeds six courses with figures, exams and history; Wipe empties it', async ({
		page
	}) => {
		test.setTimeout(120_000);
		await wipe(page);
		await page.locator('[data-seed-rich]').click();
		await expect(page.locator('[data-seed-status]')).toHaveText(
			/^Done: 6 courses, \d+ study events\.$/,
			{ timeout: 90_000 }
		);

		const courses = await readTable(page, 'courses');
		expect(courses).toHaveLength(6);
		expect(courses.filter((c) => c.examDate !== undefined)).toHaveLength(5);
		const notes = await readTable(page, 'notes');
		const types = new Set(notes.map((n) => n.type));
		for (const type of ['occlusion', 'diagram', 'cloze', 'sequence']) expect(types).toContain(type);
		const kinds = new Set(
			notes.filter((n) => n.type === 'diagram').map((n) => (n.payload as { kind: string }).kind)
		);
		expect([...kinds].sort()).toEqual(['flow', 'stack']);
		expect((await readTable(page, 'media')).length).toBeGreaterThan(0);
		const events = await readTable(page, 'events');
		expect(events.length).toBeGreaterThan(0);
		expect(events.every((e) => (e.ts as number) < Date.now())).toBe(true);
		const reviewed = (await readTable(page, 'cards')).filter((c) => c.status !== 'unseen');
		expect(reviewed.length).toBeGreaterThan(0);

		await page.goto('/courses');
		await expect(
			page.getByRole('article', { name: 'Database storage', exact: true })
		).toBeVisible();
		await expect(page.locator('[data-no-exam-hint="Systems analysis"]')).toBeVisible();

		await wipe(page);
		await page.goto('/courses');
		await expect(page.getByText('No courses on the shelf yet.')).toBeVisible();
	});

	test('Shelf stress seeds fifty courses, some with very long titles', async ({ page }) => {
		test.setTimeout(180_000);
		await wipe(page);
		await page.locator('[data-seed-shelf]').click();
		await expect(page.locator('[data-seed-status]')).toHaveText(
			'Done: 50 courses, 0 study events.',
			{
				timeout: 150_000
			}
		);
		const courses = await readTable(page, 'courses');
		expect(courses).toHaveLength(50);
		expect(courses.filter((c) => c.examDate === undefined).length).toBeGreaterThanOrEqual(10);
		await page.goto('/courses');
		await expect(page.getByRole('article')).toHaveCount(50);
	});
});
