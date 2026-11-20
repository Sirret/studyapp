import { ACQ_STEP_REQUIRED } from '#lib/config/defaults.ts';
import type { EventRepo } from '#lib/db/repos/event-repo.ts';
import type { KvRepo } from '#lib/db/repos/kv-repo.ts';
import type { CardId, ChunkId, CourseId, TopicId } from '#lib/db/schemas/common.ts';
import { learnOrder, pickLookBack, topicFlow, type LearnStep } from '#lib/engine/learn-flow.ts';
import { rngFor } from '#lib/engine/rng.ts';
import type { Logger } from '#lib/log/logger.ts';
import { courseScope } from './course-scope.ts';
import type { CourseData } from './course-plan.ts';
import {
	learnCards,
	learnSections,
	meetNotes,
	readSections,
	screenOf,
	type ScreenSource
} from './learn-material.ts';
import type { LearnFlowView, LearnTopicView } from './learn-types.ts';
import { loadCourseData, type PlanRepos } from './planner-inputs.ts';
import { isStudyable } from './study-course.ts';
import type { StudyService } from './study-service.ts';
import type { PlannedCard } from './study-plan-types.ts';
import type { StudyView } from './study-types.ts';

export interface LearnServiceDeps {
	repos: PlanRepos;
	events: EventRepo;
	kv: KvRepo;
	study: StudyService;
	logger: Logger;
}

/** A topic loaded for Learn: the scoped course data, the engine's steps and the screen sources. */
interface TopicLoad {
	data: CourseData;
	steps: LearnStep[];
	source: ScreenSource;
}

/**
 * Learn (`/course/[id]/learn`): topic by topic, summary → per section [meet the terms → read with
 * the tip → 2 questions → look-back] → mixed quiz → added sections → summary, over the in-scope
 * material. Answers are logged with mode `acquisition`, `credited: false` (next-day handoff), in
 * count rounds, with no clock and no planner minutes.
 *
 * @see SESSION_NOTES §C, §H; Decisions log "Phase 8.6 Q2", "Q3", "Q6"–"Q8", "Q13", "Q16"
 */
export class LearnService {
	constructor(private readonly deps: LearnServiceDeps) {}

	/** The in-scope topics, in course order, with their section and card counts. */
	async topics(courseId: CourseId): Promise<LearnTopicView[]> {
		const data = await this.load(courseId);
		const sections = learnSections(data.topics, data.chunks);
		const cards = this.liveCards(data);
		return [...data.topics]
			.sort((a, b) => a.order - b.order)
			.map((topic) => ({
				id: topic.id,
				name: topic.name,
				sections: sections.filter((s) => s.topicId === topic.id && !s.added).length,
				cards: cards.filter((card) => card.topicId === topic.id).length
			}));
	}

	/** A topic's flow as screens; null when the topic is not in the course or not in scope. */
	async flow(courseId: CourseId, topicId: TopicId): Promise<LearnFlowView | null> {
		const loaded = await this.loadTopic(courseId, topicId);
		if (!loaded) return null;
		const { topic } = loaded.source;
		return {
			courseId,
			topic: { id: topic.id, name: topic.name },
			screens: loaded.steps.map((step) => screenOf(loaded.source, step))
		};
	}

	/**
	 * Starts screen `index` of a topic's flow as a session: meet the terms (one matching check),
	 * the section's questions, the look-back (picked now; null when there is no candidate) or the
	 * mixed quiz. Throws for a screen that is not a session.
	 */
	async startStep(courseId: CourseId, topicId: TopicId, index: number): Promise<StudyView | null> {
		const loaded = await this.loadTopic(courseId, topicId);
		const step = loaded?.steps[index];
		if (!loaded || !step) throw new Error(`No Learn step ${index} in topic ${topicId}`);
		const cards = this.stepCards(loaded, step);
		this.deps.logger.info('learn', 'step', { topicId, step: step.step, cards: cards.length });
		if (cards.length === 0) return null;
		return this.deps.study.startPlanned(courseId, {
			mode: 'acquisition',
			cards,
			plannedMinutes: 0,
			roundBy: 'count'
		});
	}

	private stepCards(loaded: TopicLoad, step: LearnStep): PlannedCard[] {
		const once = (id: CardId): PlannedCard => ({ id, required: ACQ_STEP_REQUIRED });
		switch (step.step) {
			case 'meetTerms': {
				const notes = new Set(step.terms.noteIds);
				const first = loaded.source.cards.find((card) => notes.has(card.noteId));
				return first ? [{ ...once(first.id), kind: 'matching' }] : [];
			}
			case 'questions':
			case 'mixedQuiz':
				return step.cardIds.map(once);
			case 'lookBack': {
				const picked = this.lookBack(loaded, step.chunkId);
				return picked ? [once(picked)] : [];
			}
			case 'summary':
			case 'read':
			case 'added':
				throw new Error(`Learn step ${step.step} is not a session`);
		}
	}

	/**
	 * The look-back card after a section, from the scoped course's sections read in Learn. The rng
	 * is seeded by the section and the number of events so far, so a retry picks the same card.
	 */
	private lookBack(loaded: TopicLoad, chunkId: ChunkId): CardId | null {
		const { data, source } = loaded;
		const { result, trace } = pickLookBack({
			order: learnOrder(learnSections(data.topics, data.chunks)),
			current: chunkId,
			read: readSections(source.cards, data.events),
			cards: source.cards,
			rng: rngFor(chunkId, `lookback:${data.events.length}`, 0)
		});
		this.deps.logger.debug('learn', 'lookBack', trace);
		return result;
	}

	private async load(courseId: CourseId): Promise<CourseData> {
		const events = await this.deps.events.list();
		const scope = await courseScope(this.deps.kv, courseId);
		return loadCourseData(this.deps.repos, courseId, events, scope);
	}

	private async loadTopic(courseId: CourseId, topicId: TopicId): Promise<TopicLoad | null> {
		const data = await this.load(courseId);
		const topic = data.topics.find((candidate) => candidate.id === topicId);
		if (!topic) return null;
		const cards = this.liveCards(data);
		const notes = [...data.material.notes.values()].filter((note) => note.topicId === topicId);
		const { result: steps, trace } = topicFlow({
			topicId,
			hasSummary: (topic.summary ?? '').trim().length > 0,
			sections: learnSections(data.topics, data.chunks),
			cards: cards.filter((card) => card.topicId === topicId),
			notes: meetNotes(notes)
		});
		this.deps.logger.debug('learn', 'flow', trace);
		const source: ScreenSource = {
			topic,
			chunks: new Map(data.chunks.map((chunk) => [chunk.id, chunk])),
			notes: data.material.notes,
			cards
		};
		return { data, steps, source };
	}

	/** Unsuspended, studyable cards, as Learn sees them. */
	private liveCards(data: CourseData) {
		const live = data.material.cards.filter(
			(card) => !card.suspended && isStudyable(data.material.notes.get(card.noteId))
		);
		return learnCards(live, data.material.notes, data.events);
	}
}
