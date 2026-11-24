import { CRITERION_LATER } from '#lib/config/defaults.ts';
import type { CardId } from '#lib/db/schemas/common.ts';
import type { Chunk } from '#lib/db/schemas/course.ts';
import type { AcqStep } from '#lib/engine/acquisition.ts';
import { planCram, type CramPlan } from '#lib/engine/cram.ts';
import { longtermCards, type TodayModes } from '#lib/engine/mode-select.ts';
import {
	cramInput,
	longtermNewToday,
	morningCheckCards,
	readNewCandidates,
	reviewCards,
	type CourseData,
	type PlanEnv
} from './course-plan.ts';
import type { CramView, LearnStepView } from './course-types.ts';
import type { PlanFitView } from './planner-types.ts';
import type { PlannedCard } from './study-plan-types.ts';

/**
 * CoursePlanService's pure parts: today's review plan, the cram view and the learn screen's step
 * views.
 *
 * @see BUILD_PLAN §6.6–§6.8 and Decisions log (Phase 7)
 */

/** A course loaded for planning today. */
export interface Loaded {
	data: CourseData;
	env: PlanEnv;
	modes: TodayModes;
	today: number;
	/** The planner's minutes per day from today, or `null` when the course isn't planned. */
	share: number[] | null;
	/** The minutes per day the cram plan may use (share + all free minutes); defaults to `share`. */
	cramShare?: number[] | null;
	/** The planner's verdict for this exam. */
	fit?: PlanFitView | null;
}

export function cramView(plan: CramPlan): CramView {
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

/** Today's review: the exam-morning check, the cram session or the long-term review. */
export function reviewPlan(loaded: Loaded) {
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
		const share = loaded.cramShare ?? loaded.share ?? undefined;
		const plan = planCram(cramInput(data, env, modes.daysToExam, share)).result;
		return { kind: 'cram' as const, ...cramToday(plan), cram: plan };
	}
	const ids = longtermCards({
		cards: reviewCards(data, env.now),
		newCandidates: readNewCandidates(data),
		now: env.now,
		newPerDay: longtermNewToday(data, env, modes.daysToExam, loaded.share)
	}).result;
	return { kind: 'longterm' as const, cards: ids.map((id) => ({ id })), minutes: 0, cram: null };
}

/** A unit's acquisition steps as the learn screen shows them. */
export function stepViews(steps: readonly AcqStep[], chunks: readonly Chunk[]): LearnStepView[] {
	return steps.map((step) => {
		switch (step.step) {
			case 'pretrain':
			case 'pretest':
				return { step: step.step, cards: step.cardIds.length };
			case 'read': {
				const chunk = chunks.find((candidate) => candidate.id === step.chunkId);
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
}
