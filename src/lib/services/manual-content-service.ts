import type { ContentStore } from '#lib/db/repos/content-store.ts';
import type { ChunkId, CourseId, NoteId, TopicId } from '#lib/db/schemas/common.ts';
import type { Course } from '#lib/db/schemas/course.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import { generateCards, type NoteContent } from '#lib/engine/cardgen.ts';
import { titleOf } from '#lib/engine/exercise-prompts.ts';
import type { Logger } from '#lib/log/logger.ts';
import type { Result } from '#lib/util/result.ts';
import { createEmptyCourse } from './course-new.ts';

const LOG_AREA = 'manual';

/** A course as the Add cards screen shows it: topics, their sections and their notes. */
export interface ManualOutline {
	course: { id: CourseId; name: string };
	topics: {
		id: TopicId;
		name: string;
		sections: { id: ChunkId; title: string }[];
		notes: { id: NoteId; type: Note['type']; title: string; cards: number }[];
	}[];
}

const nextOrder = (records: readonly { order: number }[]): number =>
	records.reduce((max, record) => Math.max(max, record.order + 1), 0);

const wordCount = (text: string): number => text.split(/\s+/).filter(Boolean).length;

/**
 * Manual mode: make a course by hand, without the chatbot. Courses, topics, sections and notes are
 * written through the repositories (rule 6); a note's cards come from `generateCards`, the same
 * as an import, and are written with the note in one transaction.
 *
 * @see Decisions log "Phase 8.6 Q15" (keyterm, fact, cloze, sequence, compare, scenario, example)
 * @see DATA_MODEL §3.1–§3.5
 */
export class ManualContentService {
	constructor(
		private readonly store: ContentStore,
		private readonly logger: Logger
	) {}

	/** A new, empty course. */
	async createCourse(name: string): Promise<Course> {
		const course = await createEmptyCourse(this.store.courses, name.trim());
		this.logger.info(LOG_AREA, 'course created', { courseId: course.id });
		return course;
	}

	/** The course's topics, sections and notes, in order; `null` when the course is gone. */
	async outline(courseId: CourseId): Promise<ManualOutline | null> {
		const course = await this.store.courses.get(courseId);
		if (!course) return null;
		const topics = (await this.store.topics.listByCourse(courseId)).sort(
			(a, b) => a.order - b.order
		);
		const cards = await this.store.cards.listByCourse(courseId);
		const perNote = new Map<string, number>();
		for (const card of cards) perNote.set(card.noteId, (perNote.get(card.noteId) ?? 0) + 1);
		const views = await Promise.all(
			topics.map(async (topic) => {
				const chunks = await this.store.chunks.listByTopic(topic.id);
				const notes = await this.store.notes.listByTopic(topic.id);
				return {
					id: topic.id,
					name: topic.name,
					sections: chunks
						.sort((a, b) => a.order - b.order)
						.map((chunk, index) => ({
							id: chunk.id,
							title: chunk.title ?? `Section ${index + 1}`
						})),
					notes: notes
						.sort((a, b) => a.order - b.order)
						.map((note) => ({
							id: note.id,
							type: note.type,
							title: titleOf(note),
							cards: perNote.get(note.id) ?? 0
						}))
				};
			})
		);
		return { course: { id: course.id, name: course.name }, topics: views };
	}

	/** Adds a topic at the end of the course; it starts unread. */
	async addTopic(courseId: CourseId, name: string): Promise<TopicId> {
		const existing = await this.store.topics.listByCourse(courseId);
		const topic = await this.store.topics.create({
			courseId,
			name: name.trim(),
			order: nextOrder(existing),
			placement: 'unread',
			priority: 'normal'
		});
		this.logger.info(LOG_AREA, 'topic added', { courseId, topicId: topic.id });
		return topic.id;
	}

	/** Adds a section (title and reading text, which may be empty) at the end of a topic. */
	async addSection(topicId: TopicId, title: string, text: string): Promise<ChunkId> {
		const existing = await this.store.chunks.listByTopic(topicId);
		const chunk = await this.store.chunks.create({
			topicId,
			order: nextOrder(existing),
			text: text.trim(),
			words: wordCount(text),
			source: 'notes',
			title: title.trim()
		});
		this.logger.info(LOG_AREA, 'section added', { topicId, chunkId: chunk.id });
		return chunk.id;
	}

	/**
	 * Adds a note and its cards (one transaction). Fails, writing nothing, when the topic is gone,
	 * the section is not the topic's, the content is invalid, or it would make no cards.
	 */
	async addNote(
		topicId: TopicId,
		chunkId: ChunkId | null,
		content: NoteContent
	): Promise<Result<{ noteId: NoteId; cards: number }, string>> {
		const topic = await this.store.topics.get(topicId);
		if (!topic) return { ok: false, error: 'This topic no longer exists.' };
		const chunk = chunkId ? await this.store.chunks.get(chunkId) : undefined;
		if (chunkId && chunk?.topicId !== topicId) {
			return { ok: false, error: 'Pick a section of this topic.' };
		}
		const { result: specs, trace } = generateCards(content);
		if (specs.length === 0) return { ok: false, error: 'This note would make no cards.' };
		const deviceId = await this.store.getDeviceId();
		const order = nextOrder(await this.store.notes.listByTopic(topicId));
		let note: Note;
		try {
			note = this.store.notes.draft(
				{
					courseId: topic.courseId,
					topicId,
					...(chunkId ? { chunkId } : {}),
					order,
					priority: 'normal',
					tags: [],
					generated: false,
					check: false,
					accept: {},
					...content
				} as Parameters<ContentStore['notes']['draft']>[0],
				deviceId
			);
		} catch (error) {
			this.logger.warn(LOG_AREA, 'note rejected', { topicId, error: String(error) });
			return { ok: false, error: 'Some fields of this card are missing or wrong.' };
		}
		const cards = specs.map((spec) =>
			this.store.cards.draft(
				{ noteId: note.id, courseId: topic.courseId, ...spec, suspended: false },
				deviceId
			)
		);
		await this.store.putBatch({ notes: [note], cards });
		this.logger.info(LOG_AREA, 'note added', { noteId: note.id, cards: cards.length, trace });
		return { ok: true, value: { noteId: note.id, cards: cards.length } };
	}
}
