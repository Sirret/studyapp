import { CRITERION_FIRST, RELEARN_SESSIONS_MAX, RETENTION } from '#lib/config/defaults.ts';
import type { Priority } from '#lib/db/schemas/common.ts';
import type { FsrsCardState } from '#lib/db/schemas/card.ts';
import type { EstimateCard, EstimateContext } from '#lib/engine/estimate.ts';
import { DEFAULT_FSRS_CONFIG } from '#lib/engine/fsrs.ts';
import type { PlanCutsInput } from '#lib/engine/planner-cuts.ts';
import type {
	PlanCardItem,
	PlanCourse,
	PlanEstimateContext,
	PlanItem,
	PlanKnobs,
	PlanUnitItem
} from '#lib/engine/planner-work.ts';
import { MINUTE_PER_ATTEMPT, NOW } from './cram-fixtures.ts';
import { cardId, courseId, uuid } from './fixtures.ts';

/**
 * Shared builders for the planner unit tests and the planner-week simulation.
 * With `MINUTE_PER_ATTEMPT`, one attempt is one minute, so a new `cloze` card (p0 = P0.concept)
 * costs k / p0 + K / p0 minutes.
 *
 * @see BUILD_PLAN §6.9 ("The planner, concretely")
 */

/** Full knobs: nothing degraded. */
export const FULL_KNOBS: PlanKnobs = { criterion: CRITERION_FIRST, relearn: RELEARN_SESSIONS_MAX };

/** The planner's estimate context: planned at NOW, one minute per attempt. */
export const PLAN_CTX: PlanEstimateContext = {
	now: NOW,
	calibration: MINUTE_PER_ATTEMPT,
	fsrs: DEFAULT_FSRS_CONFIG
};

/** The estimator context matching `PLAN_CTX` at the given knobs. */
export function estimateCtx(
	knobs: PlanKnobs,
	ctx: PlanEstimateContext = PLAN_CTX
): EstimateContext {
	return {
		criterion: knobs.criterion,
		relearnSessions: knobs.relearn,
		at: ctx.now,
		calibration: ctx.calibration,
		fsrs: ctx.fsrs
	};
}

/** A `cloze` estimate card, never reviewed unless `fsrs` is given. */
export function estCard(fsrs: FsrsCardState | null = null): EstimateCard {
	return { kind: 'cloze', noteType: 'cloze', fsrs };
}

/** A new review card item (rExam 0). */
export function newItem(n: number, priority: Priority = 'normal'): PlanCardItem {
	return { type: 'card', id: cardId(n), card: estCard(), standing: 'new', priority, rExam: 0 };
}

/** A reviewed card item with a given standing and recall at exam time. */
export function reviewedItem(
	n: number,
	fsrs: FsrsCardState,
	standing: 'at-risk' | 'secure',
	rExam: number,
	priority: Priority = 'normal'
): PlanCardItem {
	return { type: 'card', id: cardId(n), card: estCard(fsrs), standing, priority, rExam };
}

/** An acquisition unit with `cardCount` new cloze cards. */
export function unitItem(
	key: string,
	learnMinutes: number,
	cardCount: number,
	priority: Priority = 'normal'
): PlanUnitItem {
	return {
		type: 'unit',
		id: key,
		learnMinutes,
		cards: Array.from({ length: cardCount }, () => estCard()),
		priority
	};
}

export function course(n: number, examDay: number, items: PlanItem[]): PlanCourse {
	return { courseId: courseId(n), examDay, items };
}

/** A unit key that sorts like `uuid(n)`. */
export const unitKey = (n: number): string => `unit-${uuid(n)}`;

/** A planner input with today = 0, no exam morning and default retention unless overridden. */
export function cutsInput(
	courses: readonly PlanCourse[],
	dayMinutes: readonly number[],
	overrides: Partial<PlanCutsInput> = {}
): PlanCutsInput {
	return {
		...PLAN_CTX,
		courses,
		today: 0,
		dayMinutes,
		examMorningMinutes: 0,
		retention: RETENTION,
		...overrides
	};
}

/** A deterministic shuffle (reverse + rotate) for order-independence checks. */
export function reorder<T>(items: readonly T[]): T[] {
	const reversed = [...items].reverse();
	return reversed.length < 2 ? reversed : [...reversed.slice(1), reversed[0]!];
}
