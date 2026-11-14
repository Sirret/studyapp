import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CardId, CourseId, NoteId } from '#lib/db/schemas/common.ts';
import { setupCardEnv, type CardEnv } from './card-list-fixtures.ts';

/** BUILD_PLAN §10 row 8.5 ("See all cards"); Decisions log "This card looks wrong" flags and pauses. */
describe('CardListService', () => {
	let env: CardEnv;

	beforeEach(async () => {
		env = await setupCardEnv();
	});

	afterEach(async () => {
		await env.db.delete();
	});

	async function cardsOf(noteId: NoteId) {
		return env.store.cards.listByNote(noteId);
	}

	/** Every card ID passed to replay, over all calls. */
	function replayed(): CardId[] {
		return env.replay.rebuildCards.mock.calls.flatMap(([ids]) => [...ids]);
	}

	describe('list', () => {
		it('is null for a course that is gone', async () => {
			expect(await env.cardList.list(randomUUID() as CourseId)).toBeNull();
		});

		it('lists every note by topic, with its cards and the counts', async () => {
			await env.importText(
				'@deck A\n@fact\nTCP :: reliable transport\nUDP :: datagrams [CHECK]\n@deck B\n@cloze\nThe {{SYN}} then {{ACK}}'
			);
			const view = await env.cardList.list(env.courseId);
			expect(view?.courseName).toBe('Networks');
			expect(view?.topics.map((topic) => topic.name)).toEqual(['A', 'B']);
			expect(view?.topics[0]?.rows.map((row) => row.prompt)).toEqual(['TCP', 'UDP']);
			expect(view?.topics[0]?.rows[0]?.answer).toBe('reliable transport');
			expect(view?.topics[0]?.rows[1]?.flagged).toBe(true);
			expect(view?.topics[1]?.rows[0]?.cards.map((card) => card.variant)).toEqual(['c1', 'c2']);
			expect(view?.total).toBe(3);
			expect(view?.flagged).toBe(1);
		});

		it('leaves out deleted notes', async () => {
			await env.importText('@deck A\n@fact\nTCP :: reliable\nUDP :: datagrams');
			await env.cardList.deleteNote((await env.noteWith('UDP')).id);
			const view = await env.cardList.list(env.courseId);
			expect(view?.topics[0]?.rows.map((row) => row.prompt)).toEqual(['TCP']);
			expect(view?.total).toBe(1);
		});
	});

	describe('editNote', () => {
		it('saves the new payload and keeps the card IDs (rule 7)', async () => {
			await env.importText('@deck A\n@fact\nTCP :: reliable');
			const note = await env.noteWith('TCP');
			const before = (await cardsOf(note.id)).map((card) => card.id).sort();

			const result = await env.cardList.editNote(note.id, {
				type: 'fact',
				payload: { term: 'TCP', definition: 'reliable, ordered transport' }
			});

			expect(result).toEqual({ ok: true, value: undefined });
			const saved = await env.store.notes.get(note.id);
			expect(saved?.payload).toMatchObject({ definition: 'reliable, ordered transport' });
			expect(saved?.updatedAt).toBeGreaterThan(note.updatedAt);
			expect((await cardsOf(note.id)).map((card) => card.id).sort()).toEqual(before);
		});

		it('adds a card for a new blank and tombstones the card of a removed one', async () => {
			await env.importText('@deck A\n@cloze\nThe {{SYN}} then {{ACK}}');
			const note = await env.noteWith('SYN');
			const [c1, c2] = [...(await cardsOf(note.id))].sort((a, b) =>
				a.variant < b.variant ? -1 : 1
			);
			await env.answer(c2?.id as CardId);

			await env.cardList.editNote(note.id, {
				type: 'cloze',
				payload: { text: 'The {{SYN}}, {{SYN-ACK}} then {{ACK}}' }
			});
			const grown = await cardsOf(note.id);
			expect(grown.map((card) => card.variant).sort()).toEqual(['c1', 'c2', 'c3']);
			expect(grown.find((card) => card.variant === 'c1')?.id).toBe(c1?.id);
			expect(grown.find((card) => card.variant === 'c2')?.id).toBe(c2?.id);

			await env.cardList.editNote(note.id, { type: 'cloze', payload: { text: 'The {{SYN}}' } });
			expect((await cardsOf(note.id)).map((card) => card.id)).toEqual([c1?.id]);
			const raw = await env.db.cards.get(c2?.id as CardId);
			expect(raw?.deleted).toBe(true);
			expect(await env.events.listByCard(c2?.id as CardId)).toHaveLength(1);
		});

		it('replays kept cards whose path changed, and only those', async () => {
			await env.importText('@deck A\n@fact\nTCP :: reliable');
			const note = await env.noteWith('TCP');
			const [fwd, rev] = [...(await cardsOf(note.id))].sort((a, b) =>
				a.variant < b.variant ? -1 : 1
			);
			await env.db.cards.update(fwd?.id as CardId, { path: ['cloze'] });

			await env.cardList.editNote(note.id, {
				type: 'fact',
				payload: { term: 'TCP', definition: 'reliable transport' }
			});

			expect(replayed()).toContain(fwd?.id);
			expect(replayed()).not.toContain(rev?.id);
			expect((await env.store.cards.get(fwd?.id as CardId))?.path).toEqual(['mc', 'cloze']);
		});

		it('clears the flag and un-pauses the cards', async () => {
			await env.importText('@deck A\n@fact\nTCP :: reliable');
			const note = await env.noteWith('TCP');
			await env.cardList.flag(note.id);

			await env.cardList.editNote(note.id, {
				type: 'fact',
				payload: { term: 'TCP', definition: 'reliable transport' }
			});

			expect((await env.store.notes.get(note.id))?.check).toBe(false);
			expect((await cardsOf(note.id)).every((card) => !card.suspended)).toBe(true);
		});

		it.each([
			[
				'a different type',
				{ type: 'keyterm', payload: { term: 'TCP', meaning: 'reliable' } } as const
			],
			['a payload invalid for its type', { type: 'fact', payload: { term: 'TCP' } }],
			['content that makes no cards', null]
		])('fails and writes nothing for %s', async (_case, content) => {
			await env.importText('@deck A\n@fact\nTCP :: reliable\n@cloze\nThe {{SYN}}');
			const fact = await env.noteWith('TCP');
			const cloze = await env.noteWith('SYN');
			const [noteId, edit] =
				content === null
					? [cloze.id, { type: 'cloze', payload: { text: 'no blanks here' } }]
					: [fact.id, content];
			const before = await env.store.notes.get(noteId);
			const cardsBefore = await cardsOf(noteId);

			const result = await env.cardList.editNote(noteId, edit as never);

			expect(result.ok).toBe(false);
			expect(await env.store.notes.get(noteId)).toEqual(before);
			expect(await cardsOf(noteId)).toEqual(cardsBefore);
		});

		it('fails for a note that is gone', async () => {
			const result = await env.cardList.editNote(randomUUID() as NoteId, {
				type: 'fact',
				payload: { term: 'a', definition: 'b' }
			});
			expect(result.ok).toBe(false);
		});
	});

	describe('deleteNote', () => {
		it('tombstones the note and its cards and keeps their review events', async () => {
			await env.importText('@deck A\n@fact\nTCP :: reliable');
			const note = await env.noteWith('TCP');
			const cards = await cardsOf(note.id);
			await env.answer(cards[0]?.id as CardId);

			await env.cardList.deleteNote(note.id);

			expect(await env.store.notes.get(note.id)).toBeUndefined();
			expect(await cardsOf(note.id)).toEqual([]);
			expect((await env.db.notes.get(note.id))?.deleted).toBe(true);
			for (const card of cards) expect((await env.db.cards.get(card.id))?.deleted).toBe(true);
			expect(await env.events.listByCard(cards[0]?.id as CardId)).toHaveLength(1);
		});
	});

	describe('flag and unflag', () => {
		it('flag marks the note to check and pauses its cards; unflag undoes both', async () => {
			await env.importText('@deck A\n@fact\nTCP :: reliable\nUDP :: datagrams');
			const note = await env.noteWith('TCP');
			const other = await env.noteWith('UDP');

			await env.cardList.flag(note.id);
			expect((await env.store.notes.get(note.id))?.check).toBe(true);
			expect((await cardsOf(note.id)).every((card) => card.suspended)).toBe(true);
			expect((await cardsOf(other.id)).every((card) => !card.suspended)).toBe(true);
			const flaggedRow = (await env.cardList.list(env.courseId))?.topics[0]?.rows[0];
			expect(flaggedRow?.flagged).toBe(true);
			expect(flaggedRow?.cards.every((card) => card.suspended)).toBe(true);

			await env.cardList.unflag(note.id);
			expect((await env.store.notes.get(note.id))?.check).toBe(false);
			expect((await cardsOf(note.id)).every((card) => !card.suspended)).toBe(true);
		});

		it('leaves notes flagged by the import unpaused', async () => {
			await env.importText('@deck A\n@fact\nTCP :: reliable [CHECK]');
			const note = await env.noteWith('TCP');
			expect(note.check).toBe(true);
			expect((await cardsOf(note.id)).every((card) => !card.suspended)).toBe(true);
		});

		it('unflag and saving an edit leave a card paused some other way paused', async () => {
			await env.importText('@deck A\n@fact\nTCP :: reliable');
			const note = await env.noteWith('TCP');
			const [card] = await cardsOf(note.id);
			const deviceId = await env.store.getDeviceId();
			await env.store.putBatch({
				cards: [env.store.cards.draftChange(card!, { suspended: true }, deviceId)]
			});

			await env.cardList.unflag(note.id);
			await env.cardList.editNote(note.id, {
				type: 'fact',
				payload: { term: 'TCP', definition: 'reliable transport' }
			});

			expect((await env.store.cards.get(card!.id))?.suspended).toBe(true);
		});
	});
});
