import type { ContentStore } from '#lib/db/repos/content-store.ts';
import type { Card } from '#lib/db/schemas/card.ts';
import type { ChunkId, CourseId, DeviceId, TopicId } from '#lib/db/schemas/common.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import { planCardRegen, type CardRegenPlan } from '#lib/engine/card-regen.ts';
import type { NoteContent } from '#lib/engine/cardgen.ts';
import type { Logger } from '#lib/log/logger.ts';
import type { Result } from '#lib/util/result.ts';
import type { ReplayService } from './replay-service.ts';
import { saveErrorMessage } from './storage-guard.ts';

type NotePatch = Parameters<ContentStore['notes']['draftChange']>[1];
type NoteDraft = Parameters<ContentStore['notes']['draft']>[0];

/**
 * A new hand-made note (not checked, not generated, normal priority) at the end of its topic,
 * drafted but not written. Throws when the payload is invalid for its type.
 *
 * @see DATA_MODEL §3.4
 */
export async function draftNewNote(
	store: ContentStore,
	topic: { id: TopicId; courseId: CourseId },
	chunkId: ChunkId | null,
	content: NoteContent,
	deviceId: DeviceId
): Promise<Note> {
	const order = (await store.notes.listByTopic(topic.id)).reduce(
		(max, note) => Math.max(max, note.order + 1),
		0
	);
	const draft = {
		courseId: topic.courseId,
		topicId: topic.id,
		...(chunkId ? { chunkId } : {}),
		order,
		priority: 'normal',
		tags: [],
		generated: false,
		check: false,
		accept: {},
		...content
	} as NoteDraft;
	return store.notes.draft(draft, deviceId);
}

/** How a save treats an edit that leaves the note with no cards. */
export interface RegenOptions {
	/** An image with no named box yet is still a valid note (Decisions log "Phase 6 step 7"). */
	allowNoCards?: boolean;
	/** The log area of the caller. */
	area: string;
}

/**
 * Writes an edited note and its regenerated cards in one batch: cards keep their IDs by variant
 * (`planCardRegen`, rule 7), lost variants are tombstoned, new ones added, and kept cards whose
 * path changed are replayed (rule 5). Saving clears the flag and un-pauses the cards the flag
 * paused. Shared by the card list and the figure editors.
 *
 * @see BUILD_PLAN §10 row 8.5, §7
 */
export class NoteRegenWriter {
	constructor(
		private readonly store: ContentStore,
		private readonly replay: Pick<ReplayService, 'rebuildCards'>,
		private readonly logger: Logger
	) {}

	/** Saves `content` over `note` (same type). Fails, writing nothing, on an invalid payload. */
	async save(
		note: Note,
		content: NoteContent,
		options: RegenOptions
	): Promise<Result<{ cards: number }, string>> {
		const existing = await this.store.cards.listByNote(note.id);
		const { result: plan, trace } = planCardRegen(content, existing);
		const cards = plan.keep.length + plan.add.length;
		if (cards === 0 && !options.allowNoCards) {
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
		} catch (error) {
			this.logger.warn(options.area, 'note edit rejected', {
				noteId: note.id,
				error: String(error),
				trace
			});
			return { ok: false, error: 'Some fields of this note are missing or wrong.' };
		}
		try {
			await this.store.putBatch({ notes: [changed.note], cards: changed.cards });
		} catch (error) {
			this.logger.error(options.area, 'note edit not saved', {
				noteId: note.id,
				error: String(error)
			});
			return { ok: false, error: saveErrorMessage(error, 'Could not save this note.') };
		}
		const replayIds = plan.keep.filter((k) => k.pathChanged).map((k) => k.cardId);
		if (replayIds.length > 0) await this.replay.rebuildCards(replayIds);
		this.logger.info(options.area, 'note edited', { noteId: note.id, trace });
		return { ok: true, value: { cards } };
	}

	/** Kept cards that change (new path or un-paused), new cards, and tombstones of lost ones. */
	private draftCards(
		note: Note,
		existing: readonly Card[],
		plan: CardRegenPlan,
		deviceId: DeviceId
	): Card[] {
		const byId = new Map(existing.map((card) => [card.id, card]));
		// Saving an edit clears the flag, so it un-pauses only when the note was flagged.
		const unpause = note.check === true;
		const kept = plan.keep.flatMap((k) => {
			const card = byId.get(k.cardId);
			if (!card || (!k.pathChanged && !(unpause && card.suspended))) return [];
			const suspended = unpause ? false : card.suspended;
			return [this.store.cards.draftChange(card, { path: k.path, suspended }, deviceId)];
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
