import type { EventRepo } from '#lib/db/repos/event-repo.ts';
import type { CardId, CourseColor, CourseId, Mode, TopicId } from '#lib/db/schemas/common.ts';
import type { Course, Topic } from '#lib/db/schemas/course.ts';
import type { LearnService } from './learn-service.ts';
import type { PlanRepos } from './planner-inputs.ts';

/** Where a "Continue" goes: the Learn topic, the Practice screen, or Exam prep. */
export type LeftOffMode = 'learn' | 'practice' | 'exam';

/**
 * Home's "Where you left off": the course and topic of the last answer, the mode it was in and
 * how much of that topic is read.
 */
export interface LeftOffView {
	courseId: CourseId;
	courseName: string;
	color: CourseColor;
	mode: LeftOffMode;
	topicId: TopicId;
	topicName: string;
	/** Sections of the topic in scope, and how many are read in Learn. */
	sections: number;
	read: number;
}

/** One course on the shelf: its topics and how many sections are read. */
export interface ShelfCourseView {
	id: CourseId;
	name: string;
	color: CourseColor;
	topics: number;
	sections: number;
	read: number;
}

export interface HomeServiceDeps {
	repos: Pick<PlanRepos, 'courses' | 'topics' | 'notes' | 'cards'>;
	events: Pick<EventRepo, 'list'>;
	learn: Pick<LearnService, 'topics'>;
}

/** Learn answers are `acquisition`; Exam prep's modes are everything but practice. */
export function leftOffMode(mode: Mode): LeftOffMode {
	switch (mode) {
		case 'acquisition':
			return 'learn';
		case 'practice':
			return 'practice';
		case 'cram':
		case 'longterm':
		case 'onenight':
			return 'exam';
	}
}

/**
 * Home and the Shelf: where the student left off, and each course's reading progress. No streaks
 * (SESSION_NOTES §K: "no streak guilt").
 *
 * @see SESSION_NOTES §K
 * @see DESIGN §12 rows "Welcome, Home, Today", "Courses"
 */
export class HomeService {
	constructor(private readonly deps: HomeServiceDeps) {}

	/** The last answered card's course and topic, or null with no answer in a live course. */
	async leftOff(): Promise<LeftOffView | null> {
		const reviews = (await this.deps.events.list())
			.filter((event) => event.type === 'review')
			.sort((a, b) => b.ts - a.ts);
		for (const event of reviews) {
			const found = await this.locate(event.cardId);
			if (!found) continue;
			const { course, topic } = found;
			const progress = (await this.deps.learn.topics(course.id)).find((t) => t.id === topic.id);
			return {
				courseId: course.id,
				courseName: course.name,
				color: course.color,
				mode: leftOffMode(event.mode),
				topicId: topic.id,
				topicName: topic.name,
				sections: progress?.sections ?? 0,
				read: progress?.read ?? 0
			};
		}
		return null;
	}

	/** A live card's live course and topic, or null when any of them is gone. */
	private async locate(cardId: CardId): Promise<{ course: Course; topic: Topic } | null> {
		const card = await this.deps.repos.cards.get(cardId);
		const course = card && (await this.deps.repos.courses.get(card.courseId));
		const note = card && (await this.deps.repos.notes.get(card.noteId));
		const topic = note && (await this.deps.repos.topics.get(note.topicId));
		return course && topic ? { course, topic } : null;
	}

	/** Every live course with its in-scope topics, sections and sections read. */
	async shelf(): Promise<ShelfCourseView[]> {
		const courses = await this.deps.repos.courses.list();
		return Promise.all(
			courses.map(async (course) => {
				const topics = await this.deps.learn.topics(course.id);
				return {
					id: course.id,
					name: course.name,
					color: course.color,
					topics: topics.length,
					sections: topics.reduce((sum, topic) => sum + topic.sections, 0),
					read: topics.reduce((sum, topic) => sum + topic.read, 0)
				};
			})
		);
	}
}
