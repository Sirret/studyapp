import type { ContentStore } from '#lib/db/repos/content-store.ts';
import type { Card } from '#lib/db/schemas/card.ts';
import type { CourseId, DeviceId, ImportId } from '#lib/db/schemas/common.ts';
import type { Chunk, Course, Media, Topic, TopicBeforeImport } from '#lib/db/schemas/course.ts';
import type { Note } from '#lib/db/schemas/note.ts';
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

/** The live records an import created (and cards later added to its notes). */
interface ImportRecords {
	topics: Topic[];
	chunks: Chunk[];
	notes: Note[];
	cards: Card[];
	media: Media[];
}

const LOG_AREA = 'import';

/** The media a note shows (an occlusion's image, a diagram's source image). */
function mediaOf(note: Note): string | undefined {
	if (note.type === 'occlusion') return note.payload.mediaId;
	if (note.type === 'diagram') return note.payload.sourceMediaId;
	return undefined;
}

/**
 * Undoes a course's latest import (`course.lastImport`): tombstones every topic, section, note,
 * card and image carrying its `importId` (images only when no other note uses them), plus every
 * card of a removed note even without the ID (cards added later by editing that note), puts back
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
	async lastImport(courseId: CourseId): Promise<LastImportView | null> {
		const course = await this.store.courses.get(courseId);
		if (!course?.lastImport) return null;
		const records = await this.collect(course, course.lastImport.importId);
		return {
			at: course.lastImport.at,
			notes: records.notes.length,
			studiedCards: records.cards.filter((card) => card.accuracy.n > 0).length
		};
	}

	/** Undoes the latest import. Fails when there is none or the course is gone. */
	async undo(courseId: CourseId): Promise<Result<UndoSummary, string>> {
		const course = await this.store.courses.get(courseId);
		if (!course) return { ok: false, error: 'That course no longer exists.' };
		const last = course.lastImport;
		if (!last) return { ok: false, error: 'There is no import to undo.' };
		const records = await this.collect(course, last.importId);
		const deviceId = await this.store.getDeviceId();
		const restored = await this.restoreTopics(last.topicsBefore, deviceId);
		const courseChange = this.store.courses.draftChange(
			course,
			{ map: last.mapBefore ?? undefined, lastImport: undefined },
			deviceId
		);
		const { topics, chunks, notes, cards, media } = this.store;
		await this.store.putBatch({
			courses: [courseChange],
			topics: [...records.topics.map((t) => topics.draftDelete(t, deviceId)), ...restored],
			chunks: records.chunks.map((c) => chunks.draftDelete(c, deviceId)),
			notes: records.notes.map((n) => notes.draftDelete(n, deviceId)),
			cards: records.cards.map((c) => cards.draftDelete(c, deviceId)),
			media: records.media.map((m) => media.draftDelete(m, deviceId))
		});
		const summary = {
			topics: records.topics.length,
			notes: records.notes.length,
			cards: records.cards.length
		};
		this.logger.info(LOG_AREA, 'import undone', { courseId, importId: last.importId, ...summary });
		return { ok: true, value: summary };
	}

	/** Finds the live records the import created, and the cards and images that go with them. */
	private async collect(course: Course, importId: ImportId): Promise<ImportRecords> {
		const allTopics = await this.store.topics.listByCourse(course.id);
		const topics = allTopics.filter((topic) => topic.importId === importId);
		const removedTopics = new Set(topics.map((topic) => topic.id));
		const fromThis = (record: { importId?: ImportId; topicId: Topic['id'] }) =>
			record.importId === importId || removedTopics.has(record.topicId);
		const perTopic = await Promise.all(
			allTopics.map(async (topic) => ({
				chunks: await this.store.chunks.listByTopic(topic.id),
				notes: await this.store.notes.listByTopic(topic.id)
			}))
		);
		const chunks = perTopic.flatMap((t) => t.chunks).filter(fromThis);
		const notes = perTopic.flatMap((t) => t.notes).filter(fromThis);
		const removedNotes = new Set(notes.map((note) => note.id));
		const cards = (await this.store.cards.listByCourse(course.id)).filter(
			(card) => card.importId === importId || removedNotes.has(card.noteId)
		);
		return { topics, chunks, notes, cards, media: await this.unusedMedia(importId, removedNotes) };
	}

	/** The import's images that no remaining note (in any course) still shows. */
	private async unusedMedia(
		importId: ImportId,
		removedNotes: ReadonlySet<string>
	): Promise<Media[]> {
		const own = (await this.store.media.list()).filter((item) => item.importId === importId);
		if (own.length === 0) return [];
		const stillUsed = new Set(
			(await this.store.notes.list())
				.filter((note) => !removedNotes.has(note.id))
				.map(mediaOf)
				.filter((id) => id !== undefined)
		);
		return own.filter((item) => !stillUsed.has(item.id));
	}

	/** The changed topics as they were before the import (topics gone since are left alone). */
	private async restoreTopics(
		before: readonly TopicBeforeImport[],
		deviceId: DeviceId
	): Promise<Topic[]> {
		const restored: Topic[] = [];
		for (const { id, ...fields } of before) {
			const topic = await this.store.topics.get(id);
			if (!topic) continue;
			const cleared = { key: undefined, from: undefined, summary: undefined, partial: undefined };
			restored.push(this.store.topics.draftChange(topic, { ...cleared, ...fields }, deviceId));
		}
		return restored;
	}
}
