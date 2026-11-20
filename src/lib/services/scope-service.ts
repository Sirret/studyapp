import type { ChunkRepo, TopicRepo } from '#lib/db/repos/content-repos.ts';
import type { KvRepo } from '#lib/db/repos/kv-repo.ts';
import type { ChunkId, CourseId, TopicId } from '#lib/db/schemas/common.ts';
import type { StudyScope } from '#lib/db/schemas/kv.ts';
import { isWholeCourse, scopeSummary } from '#lib/engine/scope.ts';
import type { Logger } from '#lib/log/logger.ts';
import { courseScope } from './course-scope.ts';

export interface ScopeServiceDeps {
	repos: { topics: TopicRepo; chunks: ChunkRepo };
	kv: KvRepo;
	logger: Logger;
}

/** A section in the scope picker. */
export interface ScopeSectionView {
	id: ChunkId;
	/** The `@section` title; null for an untitled (legacy) section, which the UI names by position. */
	title: string | null;
	/** Studied: its topic is listed, it is listed, or the whole course is. */
	checked: boolean;
}

/** A topic in the scope picker, with its sections in order. */
export interface ScopeTopicView {
	id: TopicId;
	name: string;
	/** The topic itself is listed (or the whole course is). */
	checked: boolean;
	sections: ScopeSectionView[];
}

/** What the scope picker and the doors' "Studying N of M topics · change" line show. */
export interface ScopeView {
	whole: boolean;
	topics: number;
	of: number;
	tree: ScopeTopicView[];
}

/**
 * The course's study scope (kv `studyScope`, one entry per course): which topics and sections
 * Learn, Practice and Exam prep study. No entry, or empty lists, means the whole course ("Study
 * all", the default).
 *
 * @see SESSION_NOTES J; Decisions log "Phase 8.6 Q12"
 */
export class ScopeService {
	constructor(private readonly deps: ScopeServiceDeps) {}

	/** The stored scope, or `undefined` for the whole course. */
	get(courseId: CourseId): Promise<StudyScope | undefined> {
		return courseScope(this.deps.kv, courseId);
	}

	/** The picker tree and the summary line. */
	async view(courseId: CourseId): Promise<ScopeView> {
		const scope = await this.get(courseId);
		const whole = isWholeCourse(scope);
		const tree = (await this.outline(courseId)).map((topic) => {
			const checked = whole || (scope?.topicIds.includes(topic.id) ?? false);
			return {
				...topic,
				checked,
				sections: topic.sections.map((section) => ({
					...section,
					checked: checked || (scope?.chunkIds.includes(section.id) ?? false)
				}))
			};
		});
		const summary = scopeSummary(
			tree.map((topic) => ({ id: topic.id, chunkIds: topic.sections.map((s) => s.id) })),
			scope
		);
		return { ...summary, tree };
	}

	/**
	 * Saves the scope, keeping only this course's topics and sections; a section whose topic is
	 * listed is dropped (the topic already covers it). An empty result clears the entry, so the
	 * course goes back to "Study all".
	 */
	async set(courseId: CourseId, scope: StudyScope): Promise<void> {
		const outline = await this.outline(courseId);
		const topicIds = outline.map((t) => t.id).filter((id) => scope.topicIds.includes(id));
		const chunkIds = outline
			.filter((topic) => !topicIds.includes(topic.id))
			.flatMap((topic) => topic.sections.map((s) => s.id))
			.filter((id) => scope.chunkIds.includes(id));
		const all = (await this.deps.kv.get('studyScope')) ?? {};
		const others = Object.fromEntries(Object.entries(all).filter(([id]) => id !== courseId));
		const next = isWholeCourse({ topicIds, chunkIds })
			? others
			: { ...others, [courseId]: { topicIds, chunkIds } };
		await this.deps.kv.set('studyScope', next);
		this.deps.logger.info('scope', 'set', {
			courseId,
			topics: topicIds.length,
			sections: chunkIds.length
		});
	}

	/** "Study all": clears the course's entry. */
	clear(courseId: CourseId): Promise<void> {
		return this.set(courseId, { topicIds: [], chunkIds: [] });
	}

	/** The course's topics and sections, in order. */
	private async outline(courseId: CourseId) {
		const topics = (await this.deps.repos.topics.listByCourse(courseId)).sort(
			(a, b) => a.order - b.order
		);
		return Promise.all(
			topics.map(async (topic) => {
				const chunks = (await this.deps.repos.chunks.listByTopic(topic.id)).sort(
					(a, b) => a.order - b.order
				);
				return {
					id: topic.id,
					name: topic.name,
					sections: chunks.map((chunk) => ({ id: chunk.id, title: chunk.title ?? null }))
				};
			})
		);
	}
}
