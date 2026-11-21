import type { ContentBatch, ContentStore } from '#lib/db/repos/content-store.ts';
import type {
	CourseId,
	DeviceId,
	ImportId,
	MediaId,
	Placement,
	TopicId
} from '#lib/db/schemas/common.ts';
import type { Topic, TopicBeforeImport } from '#lib/db/schemas/course.ts';
import type { PlannedTopic } from '#lib/import/build.ts';
import { sectionFingerprint } from '#lib/import/duplicates.ts';
import { imageKey } from '#lib/import/zip.ts';
import { matchTopic } from './import-map.ts';
import { toNoteFields } from './import-notes.ts';
import type { PreparedImage } from './import-service.ts';

/** What a batch is drafted from. */
export interface ImportDraftInput {
	courseId: CourseId;
	topics: PlannedTopic[];
	images: PreparedImage[];
	placements: ReadonlyMap<string, Placement>;
}

function nextOrder(records: { order: number }[]): number {
	return records.reduce((next, record) => Math.max(next, record.order + 1), 0);
}

/** A tapped placement applies, priority can rise but never fall, and the Import v2 fields update. */
function topicChanges(
	topic: Topic,
	planned: PlannedTopic,
	tapped: Placement | undefined
): Partial<Topic> {
	const priority = planned.priority === 'high' ? 'high' : topic.priority;
	const placement = tapped ?? topic.placement;
	return { priority, placement, ...topicV2Fields(planned, topic) };
}

/** Import v2 topic fields: key, lectures (merged), summary, and partial (cleared once complete). */
function topicV2Fields(planned: PlannedTopic, topic?: Topic): Partial<Topic> {
	const from = [...new Set([...(topic?.from ?? []), ...planned.from])];
	return {
		...(planned.key ? { key: planned.key } : {}),
		...(from.length > 0 ? { from } : {}),
		...(planned.summary ? { summary: planned.summary } : {}),
		partial: planned.partial
	};
}

/** What undo puts back on a topic the import changed. @see DATA_MODEL §3.1 `lastImport` */
function snapshot(topic: Topic): TopicBeforeImport {
	const { id, placement, priority, key, from, summary, partial } = topic;
	return {
		id,
		placement,
		priority,
		...(key === undefined ? {} : { key }),
		...(from === undefined ? {} : { from }),
		...(summary === undefined ? {} : { summary }),
		...(partial === undefined ? {} : { partial })
	};
}

/**
 * Whether the batch creates anything the import's undo could remove. Changed existing topics do not
 * count: a paste whose every note was a duplicate still touches its matched topic.
 *
 * @see BUILD_PLAN Decisions log "Phase 8.5 review: a no-op import keeps the previous lastImport"
 */
export function addsRecords(batch: ContentBatch, importId: ImportId): boolean {
	return (
		batch.media.length + batch.chunks.length + batch.notes.length + batch.cards.length > 0 ||
		batch.topics.some((topic) => topic.importId === importId)
	);
}

/**
 * Builds the records an import will write, reading what it needs but storing nothing, so the write
 * itself can be one transaction. New records carry the import's `importId`; topics it changes are
 * remembered as they were (`topicsBefore`), so the import can be undone. A planned section that the
 * matched topic already has (same `sectionFingerprint`) is reused, not copied.
 *
 * @see BUILD_PLAN §4.1 and §4.2
 * @see BUILD_PLAN §10 row 8.5
 */
export class ImportBatchDrafter {
	private readonly batch: ContentBatch = {
		media: [],
		topics: [],
		chunks: [],
		notes: [],
		cards: []
	};
	private readonly mediaIds = new Map<string, MediaId>();
	private readonly before = new Map<TopicId, TopicBeforeImport>();

	constructor(
		private readonly store: ContentStore,
		private readonly deviceId: DeviceId,
		private readonly importId: ImportId
	) {}

	/** The existing topics this import changes, as they were before it. */
	topicsBefore(): TopicBeforeImport[] {
		return [...this.before.values()];
	}

	/** Drafts every record of the import. */
	async draft(input: ImportDraftInput): Promise<ContentBatch> {
		for (const image of input.images) await this.draftImage(image);
		const existing = await this.store.topics.listByCourse(input.courseId);
		let order = nextOrder(existing);
		for (const planned of input.topics) {
			const match = matchTopic(existing, planned);
			const topicId = match
				? this.draftTopicChange(match, planned, input.placements)
				: this.draftNewTopic(input, planned, order++);
			await this.draftContent(input.courseId, topicId, planned);
		}
		return this.batch;
	}

	/**
	 * Stores each image once: reuses one already stored (by original-file hash, then by stored
	 * hash for images saved before Phase 6) or already in this batch.
	 *
	 * @see DATA_MODEL §3.8
	 */
	private async draftImage(image: PreparedImage): Promise<void> {
		const { fileName, hash, sourceHash, mime, width, height, blob } = image;
		const stored =
			(await this.store.media.findBySourceHash(sourceHash)) ??
			(await this.store.media.findByHash(hash));
		const media =
			stored ??
			this.batch.media.find(
				(candidate) => candidate.sourceHash === sourceHash || candidate.hash === hash
			) ??
			this.store.media.draft(
				{
					hash,
					sourceHash,
					mime,
					width,
					height,
					bytes: blob.size,
					blob,
					fileName,
					importId: this.importId
				},
				this.deviceId
			);
		if (!stored && !this.batch.media.includes(media)) this.batch.media.push(media);
		this.mediaIds.set(imageKey(fileName), media.id);
	}

	private draftNewTopic(input: ImportDraftInput, planned: PlannedTopic, order: number): TopicId {
		const topic = this.store.topics.draft(
			{
				courseId: input.courseId,
				name: planned.name,
				order,
				placement: input.placements.get(planned.name) ?? 'unread',
				priority: planned.priority,
				...topicV2Fields(planned),
				importId: this.importId
			},
			this.deviceId
		);
		this.batch.topics.push(topic);
		return topic.id;
	}

	private draftTopicChange(
		topic: Topic,
		planned: PlannedTopic,
		placements: ReadonlyMap<string, Placement>
	): TopicId {
		if (!this.before.has(topic.id)) this.before.set(topic.id, snapshot(topic));
		const changes = topicChanges(topic, planned, placements.get(planned.name));
		this.batch.topics.push(this.store.topics.draftChange(topic, changes, this.deviceId));
		return topic.id;
	}

	private async draftContent(
		courseId: CourseId,
		topicId: TopicId,
		planned: PlannedTopic
	): Promise<void> {
		const stored = await this.store.chunks.listByTopic(topicId);
		const reusable = new Map(stored.map((chunk) => [sectionFingerprint(chunk), chunk.id]));
		let chunkOrder = nextOrder(stored);
		const chunkIds = planned.chunks.map(({ line: _line, ...section }) => {
			const reused = reusable.get(sectionFingerprint(section));
			if (reused) return reused;
			const fields = { topicId, order: chunkOrder++, ...section, importId: this.importId };
			const chunk = this.store.chunks.draft(fields, this.deviceId);
			this.batch.chunks.push(chunk);
			return chunk.id;
		});
		const firstNote = nextOrder(await this.store.notes.listByTopic(topicId));
		planned.notes.forEach((planNote, index) => {
			const chunkId = planNote.chunkIndex === undefined ? undefined : chunkIds[planNote.chunkIndex];
			const place = { courseId, topicId, chunkId, order: firstNote + index };
			const note = this.store.notes.draft(
				{ ...toNoteFields(planNote, place, this.mediaIds), importId: this.importId },
				this.deviceId
			);
			this.batch.notes.push(note);
			for (const { variant, path } of planNote.cards) {
				this.batch.cards.push(
					this.store.cards.draft(
						{ noteId: note.id, courseId, variant, path, suspended: false, importId: this.importId },
						this.deviceId
					)
				);
			}
		});
	}
}
