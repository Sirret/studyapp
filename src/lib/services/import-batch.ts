import type { ContentBatch, ContentStore } from '#lib/db/repos/content-store.ts';
import type { CourseId, DeviceId, MediaId, Placement, TopicId } from '#lib/db/schemas/common.ts';
import type { Topic } from '#lib/db/schemas/course.ts';
import type { PlannedTopic } from '#lib/import/build.ts';
import { fileKey } from '#lib/import/zip.ts';
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

/**
 * Builds the records an import will write, reading what it needs but storing nothing, so the write
 * itself can be one transaction.
 *
 * @see BUILD_PLAN §4.1 and §4.2
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

	constructor(
		private readonly store: ContentStore,
		private readonly deviceId: DeviceId
	) {}

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

	/** Stores each image once, by content hash: reuses one already stored or already in this batch. */
	private async draftImage(image: PreparedImage): Promise<void> {
		const { fileName, hash, width, height, blob } = image;
		const stored = await this.store.media.findByHash(hash);
		const media =
			stored ??
			this.batch.media.find((candidate) => candidate.hash === hash) ??
			this.store.media.draft(
				{ hash, mime: 'image/webp', width, height, bytes: blob.size, blob, fileName },
				this.deviceId
			);
		if (!stored && !this.batch.media.includes(media)) this.batch.media.push(media);
		this.mediaIds.set(fileKey(fileName), media.id);
	}

	private draftNewTopic(input: ImportDraftInput, planned: PlannedTopic, order: number): TopicId {
		const topic = this.store.topics.draft(
			{
				courseId: input.courseId,
				name: planned.name,
				order,
				placement: input.placements.get(planned.name) ?? 'unread',
				priority: planned.priority,
				...topicV2Fields(planned)
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
		const changes = topicChanges(topic, planned, placements.get(planned.name));
		this.batch.topics.push(this.store.topics.draftChange(topic, changes, this.deviceId));
		return topic.id;
	}

	private async draftContent(
		courseId: CourseId,
		topicId: TopicId,
		planned: PlannedTopic
	): Promise<void> {
		const firstChunk = nextOrder(await this.store.chunks.listByTopic(topicId));
		const chunks = planned.chunks.map(({ line: _line, ...section }, index) =>
			this.store.chunks.draft({ topicId, order: firstChunk + index, ...section }, this.deviceId)
		);
		this.batch.chunks.push(...chunks);
		const firstNote = nextOrder(await this.store.notes.listByTopic(topicId));
		planned.notes.forEach((planNote, index) => {
			const chunkId =
				planNote.chunkIndex === undefined ? undefined : chunks[planNote.chunkIndex]?.id;
			const place = { courseId, topicId, chunkId, order: firstNote + index };
			const note = this.store.notes.draft(
				toNoteFields(planNote, place, this.mediaIds),
				this.deviceId
			);
			this.batch.notes.push(note);
			for (const { variant, path } of planNote.cards) {
				this.batch.cards.push(
					this.store.cards.draft(
						{ noteId: note.id, courseId, variant, path, suspended: false },
						this.deviceId
					)
				);
			}
		});
	}
}
