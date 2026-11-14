import type { ContentStore } from '#lib/db/repos/content-store.ts';
import type { CourseId } from '#lib/db/schemas/common.ts';
import type { Logger } from '#lib/log/logger.ts';
import type { Result } from '#lib/util/result.ts';

/** What the course page shows about the latest import, for its "Undo import" button. */
export interface LastImportView {
	at: number;
	/** Notes the import created that still exist. */
	notes: number;
	/** Of their cards, how many have been studied (their review history stays after undo). */
	studiedCards: number;
}

/** What an undo removed. */
export interface UndoSummary {
	topics: number;
	notes: number;
	cards: number;
}

/**
 * Undoes a course's latest import (`course.lastImport`): tombstones every topic, section, note,
 * card and image carrying its `importId` (images only when no other note uses them), puts back
 * the topics it changed and the course map as they were, and clears `lastImport`, all in one
 * transaction. Review events are never touched (rule 5).
 *
 * @see DATA_MODEL §3.1 (`lastImport`)
 * @see BUILD_PLAN §10 row 8.5
 */
export class ImportUndoService {
	constructor(
		private readonly store: ContentStore,
		private readonly logger: Logger
	) {}

	/** The latest import of the course, or `null` when there is none to undo. */
	async lastImport(_courseId: CourseId): Promise<LastImportView | null> {
		throw new Error('not implemented');
	}

	/** Undoes the latest import. Fails when there is none or the course is gone. */
	async undo(_courseId: CourseId): Promise<Result<UndoSummary, string>> {
		throw new Error('not implemented');
	}
}
