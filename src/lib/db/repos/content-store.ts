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

/**
 * The content repositories together, for work that must succeed or fail as a whole.
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
		context: RepoContext
	) {
		this.courses = new CourseRepo(db, context);
		this.topics = new TopicRepo(db, context);
		this.chunks = new ChunkRepo(db, context);
		this.notes = new NoteRepo(db, context);
		this.cards = new CardRepo(db, context);
		this.media = new MediaRepo(db, context);
	}

	/**
	 * Runs `work` in one transaction: if it throws, nothing it wrote stays. Inside `work`, await only
	 * repository calls; waiting on anything else, such as image encoding, ends the transaction.
	 */
	transact<T>(work: () => Promise<T>): Promise<T> {
		const { courses, topics, chunks, notes, cards, media, kv } = this.db;
		return this.db.transaction('rw', [courses, topics, chunks, notes, cards, media, kv], work);
	}
}
