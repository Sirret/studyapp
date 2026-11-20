import { expect, test } from '@playwright/test';
import { readTable } from './idb.ts';
import { playOpenSession } from './play-session.ts';

/**
 * Phase 8.6 step 11, Manual mode (Decisions log "Phase 8.6 Q15"; SESSION_NOTES §K): from Welcome's
 * "Make cards by hand", a course is made with no chatbot: a topic, a section with its reading, a
 * fact with ticked key words, a list fact and a cloze. The cards are then studied in Practice.
 */
test.describe('manual mode', () => {
	test.use({ reducedMotion: 'reduce', actionTimeout: 10_000 });

	test('make a course by hand, add three kinds of card, then study them', async ({ page }) => {
		test.setTimeout(180_000);
		await page.goto('/');
		await page.locator('[data-make-by-hand]').click();
		await expect(page).toHaveURL(/\/course\/new$/);
		await page.getByLabel('Course name').fill('Networks by hand');
		await page.getByLabel('First topic').fill('Switching');
		await page.locator('[data-create-course]').click();
		await page.waitForURL(/\/course\/[^/]+\/add\?topic=/);
		await expect(page.getByLabel('Topic')).toHaveValue(/.+/);

		// A section with its reading; the new section is picked for the next cards.
		await page.locator('[data-new-section]').click();
		await page.getByLabel('New section title').fill('Packets');
		await page.getByLabel('Reading (optional)').fill('Data travels in small packets.');
		await page.locator('[data-add-place]').click();
		await expect(page.getByLabel('Section').locator('option:checked')).toHaveText('Packets');

		// A fact with key words ticked as chips.
		await page.getByLabel('Term').fill('Packet switching');
		await page
			.getByLabel('Definition')
			.fill('Data split into small packets, routed independently.');
		const ticks = page.locator('[data-key-word-ticks]');
		for (const word of ['small', 'packets,', 'independently.']) {
			await ticks.getByRole('button', { name: word, exact: true }).click();
		}
		await page.locator('[data-save-note]').click();
		await expect(page.locator('[data-manual-notes] li')).toHaveCount(1);
		await expect(page.getByLabel('Term')).toHaveValue('');

		// A list fact: items one per line.
		await page.getByLabel('Term').fill('Kinds of switching');
		await page.locator('label', { hasText: "It's a list" }).click();
		await page.getByLabel('Items').fill('Circuit\nPacket\nMessage');
		await page.locator('[data-save-note]').click();
		await expect(page.locator('[data-manual-notes] li')).toHaveCount(2);

		// A cloze, through the type picker.
		await page.getByLabel('Card type').selectOption({ label: 'Fill the blank' });
		await page.getByLabel('Sentence').fill('A {{router}} forwards packets between networks.');
		await page.locator('[data-save-note]').click();
		await expect(page.locator('[data-manual-notes] li')).toHaveCount(3);
		await expect(page.locator('[data-manual-notes]')).toContainText('Packet switching');

		const notes = await readTable(page, 'notes');
		const payloads = notes.map((note) => note.payload as Record<string, unknown>);
		expect(payloads).toContainEqual({
			term: 'Packet switching',
			definition: 'Data split into small packets, routed independently.',
			keyWords: ['small packets', 'independently']
		});
		expect(payloads).toContainEqual({
			term: 'Kinds of switching',
			definition: 'Circuit, Packet and Message',
			keyWords: ['Circuit', 'Packet', 'Message'],
			list: true
		});
		const chunks = await readTable(page, 'chunks');
		expect(chunks).toHaveLength(1);
		expect(notes.every((note) => note.chunkId === chunks[0]?.id)).toBe(true);

		// Study them: the course page's Practice door, then the quick quiz.
		await page.locator('[data-manual-done]').click();
		await page.waitForURL(/\/course\/[^/]+$/);
		await page.getByRole('link', { name: /Practice/ }).click();
		await page.locator('[data-practice-quiz]').click();
		await page.waitForURL(/\/study\//);
		await playOpenSession(page);
		await page.waitForURL(/\/practice\?quiz=/);
		await expect(page.locator('[data-practice-summary]')).toContainText('right first time');
		const reviews = (await readTable(page, 'events')).filter((event) => event.type === 'review');
		const cards = await readTable(page, 'cards');
		expect(new Set(reviews.map((event) => event.cardId)).size).toBe(cards.length);
	});
});
