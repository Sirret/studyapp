import type { ContentStore } from '#lib/db/repos/content-store.ts';
import type { CourseId, NoteId } from '#lib/db/schemas/common.ts';
import type { NoteContent } from '#lib/engine/cardgen.ts';
import type { Logger } from '#lib/log/logger.ts';
import type { Result } from '#lib/util/result.ts';
import type { CardListView } from './card-list-types.ts';
import type { ReplayService } from './replay-service.ts';

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
	async list(_courseId: CourseId): Promise<CardListView | null> {
		throw new Error('not implemented');
	}

	/**
	 * Saves an edited note: cards are regenerated keeping IDs by variant (`planCardRegen`), lost
	 * variants are tombstoned, new ones added, and kept cards whose path changed are replayed.
	 * Editing clears the flag and un-pauses the note's cards. Fails (writing nothing) when the
	 * content is invalid for its type or makes no cards.
	 */
	async editNote(_noteId: NoteId, _content: NoteContent): Promise<Result<void, string>> {
		throw new Error('not implemented');
	}

	/** Deletes a note and its cards (tombstones, one transaction). Review events stay. */
	async deleteNote(_noteId: NoteId): Promise<void> {
		throw new Error('not implemented');
	}

	/** "This card looks wrong": flags the note and pauses (suspends) its cards. */
	async flag(_noteId: NoteId): Promise<void> {
		throw new Error('not implemented');
	}

	/** Clears the flag and un-pauses the note's cards. */
	async unflag(_noteId: NoteId): Promise<void> {
		throw new Error('not implemented');
	}
}
