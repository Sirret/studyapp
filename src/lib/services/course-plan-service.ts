import { ACQ_STEP_REQUIRED, CRITERION_LATER } from '#lib/config/defaults.ts';
import type {
	CardRepo,
	ChunkRepo,
	CourseRepo,
	NoteRepo,
	TopicRepo
} from '#lib/db/repos/content-repos.ts';
import type { EventRepo } from '#lib/db/repos/event-repo.ts';
import type { KvRepo } from '#lib/db/repos/kv-repo.ts';
import type { CardId, CourseId, ExamFormat, SessionId } from '#lib/db/schemas/common.ts';
import type { ReviewEvent } from '#lib/db/schemas/event.ts';
import { DEFAULT_AVAILABILITY, DEFAULT_SETTINGS } from '#lib/db/schemas/kv.ts';
import { splitFlagFor, unitSteps, type AcqStep } from '#lib/engine/acquisition.ts';
import { planCram, type CramPlan } from '#lib/engine/cram.ts';
import { EMPTY_CALIBRATION } from '#lib/engine/estimate.ts';
import { longtermCards, todayModes, type TodayModes } from '#lib/engine/mode-select.ts';
import { dayIndex } from '#lib/engine/time.ts';
import type { Logger } from '#lib/log/logger.ts';
import { oneNight, openUnits, pathFor, splitPrompts, unitView } from './course-learn.ts';
import {
	cramInput,
	dayMinutesFrom,
	examDayOf,
	morningCheckCards,
	readNewCandidates,
	reviewCards,
	type CourseData,
	type PlanEnv
} from './course-plan.ts';
import type { CourseToday, CramView, LearnStepView, LearnUnitView } from './course-types.ts';
import type { ReplayConfigSource } from './replay-service.ts';
import { loadCourse } from './study-course.ts';
import type { PlannedCard, StudyService } from './study-service.ts';
import type { StudyView } from './study-types.ts';

export interface CoursePlanDeps {
	repos: {
		courses: CourseRepo;
		topics: TopicRepo;
		chunks: ChunkRepo;
		notes: NoteRepo;
		cards: CardRepo;
	};
	events: EventRepo;
	kv: KvRepo;
	study: StudyService;
	replayConfig: ReplayConfigSource;
	clock: () => number;
	logger: Logger;
}

interface Loaded {
	data: CourseData;
	env: PlanEnv;
	modes: TodayModes;
	today: number;
}

function cramView(plan: CramPlan): CramView {
	return {
		feasible: plan.feasible,
		shortfallMinutes: Math.ceil(plan.shortfallMinutes),
		degradations: plan.degradations,
		deferred: plan.deferred.length,
		days: plan.sessions.map((s) => ({
			day: s.day,
			slot: s.slot,
			cards: s.cardIds.length,
			newCards: s.newCardIds.length,
			minutes: Math.ceil(s.minutes)
		}))
	};
}

/** Today's cram session (day 0, or the morning top-up on exam day) and each card's later sessions. */
function cramToday(plan: CramPlan): { cards: PlannedCard[]; minutes: number } {
	const session = plan.sessions.find((s) => s.day === 0);
	if (!session) return { cards: [], minutes: 0 };
	const later = plan.sessions.filter((s) => s.day > 0 && s.slot !== 'morning');
	const ahead = (id: CardId): number => later.filter((s) => s.cardIds.includes(id)).length;
	return {
		cards: session.cardIds.map((id) => ({ id, relearningSessionsAhead: ahead(id) })),
		minutes: session.minutes
	};
}

/**
 * The course page's service: works out today's modes for a course (`todayModes`), the review
 * session (long-term, cram or the exam-morning check), the units to learn (acquisition or
 * one-night) and starts each of them through `StudyService.startPlanned`.
 *
 * @see BUILD_PLAN §6.6–§6.8 and Decisions log (Phase 7)
 */
export class CoursePlanService {
	constructor(private readonly deps: CoursePlanDeps) {}

	/** Everything the course page shows for today. */
	async today(courseId: CourseId): Promise<CourseToday> {
		const { data, env, modes, today } = await this.load(courseId);
		const { course, cards } = data.material;
		const counts: CourseToday['counts'] = {};
		for (const card of cards) counts[card.status] = (counts[card.status] ?? 0) + 1;
		const review = this.reviewPlan({ data, env, modes, today });
		return {
			course: {
				id: course.id,
				name: course.name,
				color: course.color,
				examDate: course.examDate ?? null,
				examTime: course.examTime ?? null,
				examFormat: course.examFormat
			},
			daysToExam: modes.daysToExam,
			counts,
			review: {
				kind: review.kind,
				cards: review.cards.length,
				minutes: Math.ceil(review.minutes),
				cram: review.cram ? cramView(review.cram) : null
			},
			learn: this.learnPlan({ data, env, modes, today }),
			splitPrompts: splitPrompts(data, env)
		};
	}

	/** Sets or clears the exam date, time and format. */
	async setExam(
		courseId: CourseId,
		exam: { examDate: string | null; examTime: string | null; examFormat: ExamFormat }
	): Promise<void> {
		await this.deps.repos.courses.update(courseId, {
			examFormat: exam.examFormat,
			examDate: exam.examDate ?? undefined,
			examTime: (exam.examDate && exam.examTime) || undefined
		});
	}

	/** Starts today's review session. */
	async startReview(courseId: CourseId): Promise<StudyView> {
		const loaded = await this.load(courseId);
		const review = this.reviewPlan(loaded);
		const mode = review.kind === 'morningCheck' ? 'onenight' : review.kind;
		this.deps.logger.info('modes', 'review', { kind: review.kind, cards: review.cards.length });
		return this.deps.study.startPlanned(courseId, {
			mode,
			cards: review.cards,
			plannedMinutes: review.minutes
		});
	}

	/** A unit's steps for the learn screen. */
	async learnUnit(courseId: CourseId, key: string): Promise<LearnUnitView | null> {
		const loaded = await this.load(courseId);
		const found = this.findUnit(loaded, key);
		if (!found) return null;
		const steps: LearnStepView[] = found.steps.map((step) => {
			switch (step.step) {
				case 'pretrain':
				case 'pretest':
					return { step: step.step, cards: step.cardIds.length };
				case 'read': {
					const chunk = loaded.data.chunks.find((candidate) => candidate.id === step.chunkId);
					return {
						step: 'read',
						chunkId: step.chunkId,
						text: chunk?.text ?? '',
						generated: chunk?.source === 'generated'
					};
				}
				case 'quiz':
					return { step: 'quiz', cards: step.cards.length, kinds: step.cards.map((c) => c.kind) };
			}
		});
		return { courseId, mode: found.mode, unit: found.view, steps };
	}

	/** Starts step `index` of a unit (pretrain, pretest or quiz) as its own session. */
	async startLearnStep(courseId: CourseId, key: string, index: number): Promise<StudyView> {
		const found = this.findUnit(await this.load(courseId), key);
		const step = found?.steps[index];
		if (!found || !step || step.step === 'read')
			throw new Error(`No session step ${index} in ${key}`);
		const cards: PlannedCard[] =
			step.step === 'quiz'
				? step.cards.map(({ id, kind }) => ({ id, kind, required: ACQ_STEP_REQUIRED }))
				: step.cardIds.map((id) =>
						step.step === 'pretest'
							? { id, kind: 'pretest' as const }
							: { id, required: ACQ_STEP_REQUIRED }
					);
		return this.deps.study.startPlanned(courseId, {
			mode: found.mode,
			cards,
			plannedMinutes: found.view.minutes
		});
	}

	/** Starts one-night block 2: a mixed re-quiz of everything from block 1. */
	async startBlockTwo(courseId: CourseId): Promise<StudyView> {
		const cards = this.metTonight(await this.load(courseId));
		return this.deps.study.startPlanned(courseId, {
			mode: 'onenight',
			cards: cards.map((id) => ({ id, required: CRITERION_LATER })),
			plannedMinutes: 0
		});
	}

	/** After a unit's chunk quiz: sets the split flag when first-attempt accuracy was low. */
	async finishQuiz(courseId: CourseId, sessionId: SessionId, chunkId: string): Promise<boolean> {
		const existing = await this.deps.repos.chunks.get(chunkId);
		if (existing?.splitFlag === true) return true;
		const events = await this.deps.events.listBySession(sessionId);
		const first = events.filter(
			(event): event is ReviewEvent =>
				event.type === 'review' && event.firstAttempt && event.weight !== 'none'
		);
		const flagged = splitFlagFor(first);
		const chunk = (await this.load(courseId)).data.chunks.find((c) => c.id === chunkId);
		if (flagged && chunk && chunk.splitFlag !== true) {
			await this.deps.repos.chunks.update(chunk.id, { splitFlag: true });
		}
		return flagged;
	}

	private async load(courseId: CourseId): Promise<Loaded> {
		const { repos, kv } = this.deps;
		const material = await loadCourse(repos, courseId);
		const topics = await repos.topics.listByCourse(courseId);
		const chunks = (await Promise.all(topics.map((t) => repos.chunks.listByTopic(t.id)))).flat();
		const events = await this.deps.events.list();
		const config = await this.deps.replayConfig();
		const now = this.deps.clock();
		const env: PlanEnv = {
			now,
			tzOffsetMin: config.tzOffsetMin,
			fsrs: config.fsrs,
			settings: (await kv.get('settings')) ?? DEFAULT_SETTINGS,
			availability: (await kv.get('availability')) ?? DEFAULT_AVAILABILITY,
			calibration: (await kv.get('calibration')) ?? EMPTY_CALIBRATION
		};
		const data: CourseData = { material, topics, chunks, events };
		const today = dayIndex(now, env.tzOffsetMin);
		const hasUnread = openUnits(data, env, false).units.length > 0;
		const modes = todayModes({ today, examDay: examDayOf(material.course), hasUnread }).result;
		return { data, env, modes, today };
	}

	private reviewPlan(loaded: Loaded) {
		const { data, env, modes, today } = loaded;
		const morning = modes.daysToExam === 0 ? morningCheckCards(data, today, env.tzOffsetMin) : [];
		if (morning.length > 0) {
			const cards = morning.map((id) => ({ id, required: CRITERION_LATER }));
			return {
				kind: 'morningCheck' as const,
				cards,
				minutes: env.availability.examMorningMinutes,
				cram: null
			};
		}
		if (modes.review === 'cram' && modes.daysToExam !== null) {
			const plan = planCram(cramInput(data, env, modes.daysToExam)).result;
			return { kind: 'cram' as const, ...cramToday(plan), cram: plan };
		}
		const ids = longtermCards({
			cards: reviewCards(data, env.now),
			newCandidates: readNewCandidates(data),
			now: env.now
		}).result;
		return { kind: 'longterm' as const, cards: ids.map((id) => ({ id })), minutes: 0, cram: null };
	}

	private learnPlan(loaded: Loaded): CourseToday['learn'] {
		const { data, env, modes } = loaded;
		if (modes.learn === 'onenight') {
			const plan = oneNight(data, env, this.tonight(loaded)).view;
			return { mode: 'onenight', plan: { ...plan, block2Cards: this.metTonight(loaded).length } };
		}
		if (modes.learn !== 'acquisition') return null;
		const open = openUnits(data, env, modes.daysToExam !== null);
		const path = pathFor(data, env, open, this.minutesBeforeExam(loaded));
		const units = open.units.map((unit) =>
			unitView(data, env, { unit, all: open.units, cards: open.cards, path })
		);
		return { mode: 'acquisition', path, units };
	}

	private findUnit(loaded: Loaded, key: string) {
		const { data, env, modes } = loaded;
		const mode = modes.learn === 'onenight' ? ('onenight' as const) : ('acquisition' as const);
		// Done units too, so the screen can finish a unit whose quiz just ended.
		const open = openUnits(data, env, modes.daysToExam !== null, false);
		const unit = open.units.find((candidate) => candidate.key === key);
		if (!unit) return null;
		const path =
			mode === 'onenight' ? 'quick' : pathFor(data, env, open, this.minutesBeforeExam(loaded));
		const steps: AcqStep[] = unitSteps({
			unit,
			cards: open.cards,
			path,
			pretestOn: env.settings.acquisition.pretest
		}).result;
		const view = unitView(data, env, { unit, all: open.units, cards: open.cards, path });
		return { mode, unit, steps, view };
	}

	private tonight(loaded: Loaded): number {
		return dayMinutesFrom(loaded.env.availability, loaded.today, 1)[0] ?? 0;
	}

	private minutesBeforeExam(loaded: Loaded): number | null {
		const days = loaded.modes.daysToExam;
		if (days === null) return null;
		return dayMinutesFrom(loaded.env.availability, loaded.today, days).reduce((a, b) => a + b, 0);
	}

	/** Cards met in one-night mode today, for block 2 once block 1 has emptied the open units. */
	private metTonight(loaded: Loaded): CardId[] {
		const { data, env, today } = loaded;
		const ids = new Set<CardId>();
		for (const event of data.events) {
			if (event.type !== 'review' || event.mode !== 'onenight') continue;
			if (dayIndex(event.ts, env.tzOffsetMin) === today) ids.add(event.cardId);
		}
		return data.material.cards.map((card) => card.id).filter((id) => ids.has(id));
	}
}
