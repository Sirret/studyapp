import type { ContentStore } from '#lib/db/repos/content-store.ts';
import type { CourseId, NoteId } from '#lib/db/schemas/common.ts';
import type { NoteType } from '#lib/db/schemas/note.ts';
import type { NoteContent } from '#lib/engine/cardgen.ts';
import type { Logger } from '#lib/log/logger.ts';
import type { Result } from '#lib/util/result.ts';
import type { CardListView } from './card-list-types.ts';
import { toCardList } from './card-list.ts';
import { NoteRegenWriter } from './note-regen.ts';
import type { ReplayService } from './replay-service.ts';

const LOG_AREA = 'cards';

/**
 * The "See all cards" screen's service: list a course's cards and fix them in place. Every write
 * goes through the repositories (tombstones, `updatedAt`, rule 6); card IDs survive an edit
 * (rule 7); scheduling caches are only rebuilt by replay (rule 5).
 *
 * @see BUILD_PLAN §10 row 8.5
 */
export class CardListService {
	private readonly writer: NoteRegenWriter;

	constructor(
		private readonly store: ContentStore,
		replay: Pick<ReplayService, 'rebuildCards'>,
		private readonly logger: Logger
	) {
		this.writer = new NoteRegenWriter(store, replay, logger);
	}

	/** The course's card list, or `null` when the course is gone. */
	async list(courseId: CourseId): Promise<CardListView | null> {
		const course = await this.store.courses.get(courseId);
		if (!course) return null;
		const topics = await this.store.topics.listByCourse(courseId);
		const perTopic = await Promise.all(topics.map((t) => this.store.notes.listByTopic(t.id)));
		const cards = await this.store.cards.listByCourse(courseId);
		return toCardList({ course, topics, notes: perTopic.flat(), cards });
	}

	/**
	 * Saves an edited note: cards are regenerated keeping IDs by variant (`planCardRegen`), lost
	 * variants are tombstoned, new ones added, and kept cards whose path changed are replayed.
	 * Editing clears the flag and un-pauses the note's cards. The note keeps its type. Fails
	 * (writing nothing) when `content.type` differs from the note's, the payload is invalid for
	 * its type, or it makes no cards.
	 */
	async editNote(noteId: NoteId, content: NoteContent): Promise<Result<void, string>> {
		const note = await this.store.notes.get(noteId);
		if (!note) return { ok: false, error: 'This note no longer exists.' };
		if (content.type !== note.type) {
			return { ok: false, error: 'A note keeps its type; delete it and add a new one instead.' };
		}
		const saved = await this.writer.save(note, content, { area: LOG_AREA });
		return saved.ok ? { ok: true, value: undefined } : saved;
	}

	/**
	 * Where an image or diagram note is edited (its own editor screen; the card list's inline
	 * editor has no fields for them), or `null` for every other type.
	 *
	 * @see WIP step 7; BUILD_PLAN §7
	 */
	editorHref(note: { courseId: CourseId; noteId: NoteId; type: NoteType }): string | null {
		switch (note.type) {
			case 'occlusion':
				return `/course/${note.courseId}/image/${note.noteId}`;
			case 'diagram':
				return `/course/${note.courseId}/diagram/${note.noteId}`;
			default:
				return null;
		}
	}

	/** Deletes a note and its cards (tombstones, one transaction). Review events stay. */
	async deleteNote(noteId: NoteId): Promise<void> {
		const note = await this.store.notes.get(noteId);
		if (!note) return;
		const cards = await this.store.cards.listByNote(noteId);
		const deviceId = await this.store.getDeviceId();
		await this.store.putBatch({
			notes: [this.store.notes.draftDelete(note, deviceId)],
			cards: cards.map((card) => this.store.cards.draftDelete(card, deviceId))
		});
		this.logger.info(LOG_AREA, 'note deleted', { noteId, cards: cards.length });
	}

	/** "This card looks wrong": flags the note and pauses (suspends) its cards. */
	async flag(noteId: NoteId): Promise<void> {
		await this.setFlag(noteId, true);
	}

	/** Clears the flag and un-pauses the note's cards. */
	async unflag(noteId: NoteId): Promise<void> {
		await this.setFlag(noteId, false);
	}

	private async setFlag(noteId: NoteId, flagged: boolean): Promise<void> {
		const note = await this.store.notes.get(noteId);
		// Only un-pause cards the flag paused: an unflagged note's paused cards stay paused.
		if (!note || (!flagged && !note.check)) return;
		const cards = await this.store.cards.listByNote(noteId);
		const deviceId = await this.store.getDeviceId();
		await this.store.putBatch({
			notes: [this.store.notes.draftChange(note, { check: flagged }, deviceId)],
			cards: cards
				.filter((card) => card.suspended !== flagged)
				.map((card) => this.store.cards.draftChange(card, { suspended: flagged }, deviceId))
		});
		this.logger.info(LOG_AREA, flagged ? 'note flagged' : 'note unflagged', { noteId });
	}
}
