import type { ContentStore } from '#lib/db/repos/content-store.ts';
import type { Card } from '#lib/db/schemas/card.ts';
import type { CourseId, DeviceId, NoteId } from '#lib/db/schemas/common.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import { planCardRegen, type CardRegenPlan } from '#lib/engine/card-regen.ts';
import type { NoteContent } from '#lib/engine/cardgen.ts';
import type { Logger } from '#lib/log/logger.ts';
import type { Result } from '#lib/util/result.ts';
import type { CardListView } from './card-list-types.ts';
import { toCardList } from './card-list.ts';
import type { ReplayService } from './replay-service.ts';

const LOG_AREA = 'cards';

type NotePatch = Parameters<ContentStore['notes']['draftChange']>[1];

/**
 * The "See all cards" screen's service: list a course's cards and fix them in place. Every write
 * goes through the repositories (tombstones, `updatedAt`, rule 6); card IDs survive an edit
 * (rule 7); scheduling caches are only rebuilt by replay (rule 5).
 *
 * @see BUILD_PLAN §10 row 8.5
 */
export class CardListService {
	constructor(
		private readonly store: ContentStore,
		private readonly replay: Pick<ReplayService, 'rebuildCards'>,
		private readonly logger: Logger
	) {}

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
		const existing = await this.store.cards.listByNote(noteId);
		const { result: plan, trace } = planCardRegen(content, existing);
		if (plan.keep.length + plan.add.length === 0) {
			return { ok: false, error: 'This note would make no cards.' };
		}
		const deviceId = await this.store.getDeviceId();
		let changed: { note: Note; cards: Card[] };
		try {
			const patch = { payload: content.payload, check: false } as NotePatch;
			changed = {
				note: this.store.notes.draftChange(note, patch, deviceId),
				cards: this.draftCards(note, existing, plan, deviceId)
			};
		} catch {
			return { ok: false, error: 'Some fields of this note are missing or wrong.' };
		}
		await this.store.putBatch({ notes: [changed.note], cards: changed.cards });
		const replayIds = plan.keep.filter((k) => k.pathChanged).map((k) => k.cardId);
		if (replayIds.length > 0) await this.replay.rebuildCards(replayIds);
		this.logger.info(LOG_AREA, 'note edited', { noteId, trace });
		return { ok: true, value: undefined };
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
		if (!note) return;
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

	/** Kept cards that change (new path or un-paused), new cards, and tombstones of lost ones. */
	private draftCards(
		note: Note,
		existing: readonly Card[],
		plan: CardRegenPlan,
		deviceId: DeviceId
	): Card[] {
		const byId = new Map(existing.map((card) => [card.id, card]));
		const kept = plan.keep.flatMap((k) => {
			const card = byId.get(k.cardId);
			if (!card || (!k.pathChanged && !card.suspended)) return [];
			return [this.store.cards.draftChange(card, { path: k.path, suspended: false }, deviceId)];
		});
		const added = plan.add.map((spec) =>
			this.store.cards.draft(
				{ noteId: note.id, courseId: note.courseId, ...spec, suspended: false },
				deviceId
			)
		);
		const removed = plan.remove.flatMap((id) => {
			const card = byId.get(id);
			return card ? [this.store.cards.draftDelete(card, deviceId)] : [];
		});
		return [...kept, ...added, ...removed];
	}
}
