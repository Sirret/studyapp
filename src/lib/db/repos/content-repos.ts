import type { CardCaches, Card } from '../schemas/card.ts';
import { CardSchema, EMPTY_CARD_CACHES } from '../schemas/card.ts';
import type { CardId, CourseId, NoteId, TopicId } from '../schemas/common.ts';
import {
	ChunkSchema,
	CourseSchema,
	MediaSchema,
	TopicSchema,
	type Chunk,
	type Course,
	type Media,
	type Topic
} from '../schemas/course.ts';
import type { DistributiveOmit } from '../schemas/event.ts';
import { NoteSchema, type Note } from '../schemas/note.ts';
import type { SnowpackDb } from '../schema.ts';
import { ContentRepo, type RepoContext, type RepoManaged } from './content-repo.ts';

/** @see DATA_MODEL §3.1 */
export class CourseRepo extends ContentRepo<Course, Omit<Course, RepoManaged>> {
	constructor(db: SnowpackDb, context: RepoContext) {
		super(db.courses, CourseSchema, context);
	}
}

/** @see DATA_MODEL §3.2 */
export class TopicRepo extends ContentRepo<Topic, Omit<Topic, RepoManaged>> {
	constructor(db: SnowpackDb, context: RepoContext) {
		super(db.topics, TopicSchema, context);
	}

	/** Returns a course's live topics, in order. */
	async listByCourse(courseId: CourseId): Promise<Topic[]> {
		const topics = await this.table.where('courseId').equals(courseId).sortBy('order');
		return topics.filter((topic) => !topic.deleted);
	}
}

/** @see DATA_MODEL §3.3 */
export class ChunkRepo extends ContentRepo<Chunk, Omit<Chunk, RepoManaged>> {
	constructor(db: SnowpackDb, context: RepoContext) {
		super(db.chunks, ChunkSchema, context);
	}

	/** Returns a topic's live chunks, in reading order. */
	async listByTopic(topicId: TopicId): Promise<Chunk[]> {
		const chunks = await this.table.where('topicId').equals(topicId).sortBy('order');
		return chunks.filter((chunk) => !chunk.deleted);
	}
}

/** @see DATA_MODEL §3.4 */
export class NoteRepo extends ContentRepo<Note, DistributiveOmit<Note, RepoManaged>> {
	constructor(db: SnowpackDb, context: RepoContext) {
		super(db.notes, NoteSchema, context);
	}

	/** Returns a topic's live notes. */
	async listByTopic(topicId: TopicId): Promise<Note[]> {
		const notes = await this.table.where('topicId').equals(topicId).toArray();
		return notes.filter((note) => !note.deleted);
	}
}

/** What may be written to a card: its structure, never its caches. @see CLAUDE.md rule 5 */
export type CardContent = Omit<Card, RepoManaged | keyof CardCaches>;

/** @see DATA_MODEL §3.5 */
export class CardRepo extends ContentRepo<Card, CardContent> {
	constructor(
		private readonly db: SnowpackDb,
		context: RepoContext
	) {
		super(db.cards, CardSchema, context, () => ({ ...EMPTY_CARD_CACHES }));
	}

	/** Returns a note's live cards. */
	async listByNote(noteId: NoteId): Promise<Card[]> {
		const cards = await this.table.where('noteId').equals(noteId).toArray();
		return cards.filter((card) => !card.deleted);
	}

	/** Returns a course's live cards. */
	async listByCourse(courseId: CourseId): Promise<Card[]> {
		const cards = await this.table.where('courseId').equals(courseId).toArray();
		return cards.filter((card) => !card.deleted);
	}

	/**
	 * Stores what `replay()` computed, and is to be called only with its output. A cache is not an
	 * edit, so `updatedAt` stays as it is and merging is unaffected.
	 */
	async applyReplay(caches: Record<CardId, CardCaches>): Promise<void> {
		const updates = Object.entries(caches).map(([key, changes]) => ({
			key,
			// `due` is optional: clear it explicitly when replay has no due time.
			changes: { due: undefined, ...changes }
		}));
		await this.db.cards.bulkUpdate(updates);
	}
}

/** @see DATA_MODEL §3.8 */
export class MediaRepo extends ContentRepo<Media, Omit<Media, RepoManaged>> {
	constructor(db: SnowpackDb, context: RepoContext) {
		super(db.media, MediaSchema, context);
	}

	/** Finds a live image by content hash, for de-duplication. */
	async findByHash(hash: string): Promise<Media | undefined> {
		const matches = await this.table.where('hash').equals(hash).toArray();
		return matches.find((media) => !media.deleted);
	}
}
