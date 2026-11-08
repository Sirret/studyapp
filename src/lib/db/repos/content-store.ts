import type { Card } from '../schemas/card.ts';
import type { CourseId, DeviceId } from '../schemas/common.ts';
import type { Chunk, Media, Topic } from '../schemas/course.ts';
import type { Note } from '../schemas/note.ts';
import type { SnowpackDb } from '../schema.ts';
import type { RepoContext } from './content-repo.ts';
import {
	CardRepo,
	ChunkRepo,
	CourseRepo,
	MediaRepo,
	NoteRepo,
	TopicRepo
} from './content-repos.ts';

/** Records to write together, built with each repository's `draft` and `draftChange`. */
export interface ContentBatch {
	media: Media[];
	/** New topics and changed existing ones. */
	topics: Topic[];
	chunks: Chunk[];
	notes: Note[];
	cards: Card[];
}

/**
 * The content repositories together, for writes that must succeed or fail as a whole.
 *
 * @see BUILD_PLAN §4.1 (commit in one transaction)
 * @see CLAUDE.md rule 6
 */
export class ContentStore {
	readonly courses: CourseRepo;
	readonly topics: TopicRepo;
	readonly chunks: ChunkRepo;
	readonly notes: NoteRepo;
	readonly cards: CardRepo;
	readonly media: MediaRepo;

	constructor(
		private readonly db: SnowpackDb,
		private readonly context: RepoContext
	) {
		this.courses = new CourseRepo(db, context);
		this.topics = new TopicRepo(db, context);
		this.chunks = new ChunkRepo(db, context);
		this.notes = new NoteRepo(db, context);
		this.cards = new CardRepo(db, context);
		this.media = new MediaRepo(db, context);
	}

	/** This device's ID, for building a batch. */
	getDeviceId(): Promise<DeviceId> {
		return this.context.getDeviceId();
	}

	/**
	 * Writes a batch in one transaction: if any write fails, nothing stays. Read and validate first,
	 * then call this. Don't wrap repository calls in your own Dexie transaction: awaiting an async
	 * helper inside one can silently drop it, and later writes then can't roll back.
	 */
	writeBatch(batch: ContentBatch): Promise<void> {
		const { media, topics, chunks, notes, cards } = this.db;
		return this.db.transaction('rw', [media, topics, chunks, notes, cards], async () => {
			await media.bulkAdd(batch.media);
			await topics.bulkPut(batch.topics);
			await chunks.bulkAdd(batch.chunks);
			await notes.bulkAdd(batch.notes);
			await cards.bulkAdd(batch.cards);
		});
	}

	/**
	 * Trashes a course: the course and its topics, chunks, notes and cards are marked deleted in one
	 * transaction, so the deletion can merge to other devices. Study events stay (append-only), and
	 * media stays (shared by hash). Does nothing if the course is already gone.
	 *
	 * @see CLAUDE.md rule 6 and Decisions log (trash a course)
	 */
	async trashCourse(courseId: CourseId): Promise<void> {
		const course = await this.courses.get(courseId);
		if (!course) return;
		const topics = await this.topics.listByCourse(courseId);
		const perTopic = await Promise.all(
			topics.map(async (topic) => ({
				chunks: await this.chunks.listByTopic(topic.id),
				notes: await this.notes.listByTopic(topic.id)
			}))
		);
		const cards = await this.cards.listByCourse(courseId);
		const deviceId = await this.getDeviceId();
		const updatedAt = this.context.clock();
		const tomb = <T extends object>(record: T): T => ({
			...record,
			deleted: true,
			updatedAt,
			deviceId
		});
		const { courses, topics: topicTable, chunks, notes, cards: cardTable } = this.db;
		await this.db.transaction('rw', [courses, topicTable, chunks, notes, cardTable], async () => {
			await courses.put(tomb(course));
			await topicTable.bulkPut(topics.map(tomb));
			await chunks.bulkPut(perTopic.flatMap((t) => t.chunks).map(tomb));
			await notes.bulkPut(perTopic.flatMap((t) => t.notes).map(tomb));
			await cardTable.bulkPut(cards.map(tomb));
		});
	}
}
