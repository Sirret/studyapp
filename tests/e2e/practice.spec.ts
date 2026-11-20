import { expect, test, type Page } from '@playwright/test';
import { readTable } from './idb.ts';
import { openLearnCourse } from './learn-course.ts';
import { playOpenSession } from './play-session.ts';

/**
 * Phase 8.6 Practice (SESSION_NOTES C; Decisions log "Phase 8.6 Q4", "Q16", "Q18"): from the course
 * page's Practice door, the flashcard deck runs a pass and sends the "Still learning" cards round
 * again without logging anything; the quick quiz asks every card, logs `practice` reviews that are
 * never credited, ends on its own summary, and leaves every card's scheduling fields unchanged.
 */

/** The scheduling caches replay rebuilds (CLAUDE.md rule 5), per card id. */
async function scheduling(page: Page): Promise<Record<string, unknown>> {
	const cards = await readTable(page, 'cards');
	const fields = [
		'fsrs',
		'due',
		'status',
		'fragile',
		'weak',
		'daysCorrect',
		'pathStep',
		'accuracy'
	];
	return Object.fromEntries(
		cards.map((card) => [String(card.id), fields.map((field) => card[field] ?? null)])
	);
}

test.describe('practice', () => {
	test.use({ reducedMotion: 'reduce', actionTimeout: 10_000 });

	test('flashcards go round again, the quick quiz ends on its summary, FSRS never changes', async ({
		page
	}) => {
		test.setTimeout(240_000);
		await openLearnCourse(page);
		const before = await scheduling(page);
		await page.getByRole('link', { name: /Practice/ }).click();
		await expect(page.getByRole('heading', { name: 'Just practise' })).toBeVisible();

		// Flashcards: the first card "Still learning", the rest "Know it"; then one more pass.
		await page.locator('[data-practice-deck]').click();
		const deck = page.locator('[data-flashcard-deck]');
		const done = page.locator('[data-deck-done]');
		await expect(deck).toBeVisible();
		await page.locator('[data-deck-learning]').click();
		for (let guard = 0; guard < 50 && !(await done.isVisible()); guard += 1) {
			await page.locator('[data-deck-know]').click();
			await expect(deck.or(done).first()).toBeVisible();
		}
		await expect(done).toContainText('1 still learning');
		await page.locator('[data-deck-again]').click();
		await expect(deck).toContainText('Card 1 of 1');
		await page.locator('[data-deck-know]').click();
		await expect(done).toContainText('1 card known, 0 still learning');
		expect(await readTable(page, 'events')).toHaveLength(0);
		await page.getByRole('link', { name: 'Back to Practice' }).click();

		// Quick quiz: straight back to Practice's own summary, no session summary in between.
		await page.locator('[data-practice-quiz]').click();
		await page.waitForURL(/\/study\//);
		await playOpenSession(page);
		await page.waitForURL(/\/practice\?quiz=/);
		await expect(page.locator('[data-session-summary]')).toHaveCount(0);
		const cards = Object.keys(before).length;
		await expect(page.locator('[data-practice-summary]')).toHaveText(
			`${cards} of ${cards} right first time.`
		);
		await expect(page.locator('[data-quiz-missed]')).toHaveCount(0);

		const reviews = (await readTable(page, 'events')).filter((event) => event.type === 'review');
		expect(new Set(reviews.map((event) => event.cardId)).size).toBe(cards);
		expect(reviews.every((event) => event.mode === 'practice' && event.credited === false)).toBe(
			true
		);
		expect(await scheduling(page)).toEqual(before);
	});
});
