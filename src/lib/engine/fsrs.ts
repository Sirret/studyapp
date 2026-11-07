import {
	createEmptyCard,
	fsrs,
	generatorParameters,
	Rating,
	type Card,
	type FSRS,
	type Grade
} from 'ts-fsrs';
import {
	FSRS_MAXIMUM_INTERVAL_DAYS,
	MIN_CAPPED_INTERVAL_DAYS,
	RETENTION
} from '#lib/config/defaults.ts';
import type { FsrsCardState } from '#lib/db/schemas/card.ts';
import type { Weight } from '#lib/db/schemas/common.ts';
import { MS_PER_DAY } from './time.ts';
import type { Traced } from './trace.ts';

/** The auto-assigned ratings. `Easy` is never auto-assigned in v1. @see BUILD_PLAN §6.2 */
export type FsrsRating = 'again' | 'hard' | 'good';

/** FSRS settings: target retention, longest interval, and personal weights once optimised. */
export interface FsrsConfig {
	retention: number;
	maximumIntervalDays: number;
	/** Optimised parameters from `kv.fsrsParams`; the library's defaults when absent. */
	weights?: readonly number[];
}

/** @see BUILD_PLAN §6.2 and §13 */
export const DEFAULT_FSRS_CONFIG: FsrsConfig = {
	retention: RETENTION,
	maximumIntervalDays: FSRS_MAXIMUM_INTERVAL_DAYS
};

const GRADE: Readonly<Record<FsrsRating, Grade>> = {
	again: Rating.Again,
	hard: Rating.Hard,
	good: Rating.Good
};

/**
 * A scheduler for this config. ts-fsrs 6's `fsrs()` facade is deprecated but synchronous and
 * FSRS-6; this file is the only place that touches the library.
 *
 * @see Decisions log (ts-fsrs 6)
 */
function schedulerFor(config: FsrsConfig): FSRS {
	return fsrs(
		generatorParameters({
			request_retention: config.retention,
			maximum_interval: config.maximumIntervalDays,
			enable_fuzz: false,
			enable_short_term: false,
			...(config.weights ? { w: config.weights } : {})
		})
	);
}

function toCard(state: FsrsCardState): Card {
	return {
		due: new Date(state.due),
		stability: state.stability,
		difficulty: state.difficulty,
		scheduled_days: state.scheduled_days,
		learning_steps: state.learning_steps,
		reps: state.reps,
		lapses: state.lapses,
		state: state.state as Card['state'],
		...(state.last_review === undefined ? {} : { last_review: new Date(state.last_review) })
	};
}

function fromCard(card: Card): FsrsCardState {
	return {
		due: card.due.getTime(),
		stability: card.stability,
		difficulty: card.difficulty,
		scheduled_days: card.scheduled_days,
		learning_steps: card.learning_steps,
		reps: card.reps,
		lapses: card.lapses,
		state: card.state,
		...(card.last_review === undefined ? {} : { last_review: card.last_review.getTime() })
	};
}

/**
 * The rating for a first-attempt answer: full-weight correct → good, recognition correct → hard,
 * wrong → again. `none`-weight answers never reach FSRS (null).
 *
 * @see BUILD_PLAN §6.2
 */
export function ratingFor(weight: Weight, correct: boolean): FsrsRating | null {
	if (weight === 'none') return null;
	if (!correct) return 'again';
	return weight === 'full' ? 'good' : 'hard';
}

/**
 * Applies one FSRS review at `ts` (short-term steps and fuzz off). A null state is a new card.
 *
 * @see BUILD_PLAN §6.2
 */
export function reviewFsrs(
	state: FsrsCardState | null,
	ts: number,
	rating: FsrsRating,
	config: FsrsConfig = DEFAULT_FSRS_CONFIG
): Traced<FsrsCardState> {
	const card = state ? toCard(state) : createEmptyCard(new Date(ts));
	const next = fromCard(schedulerFor(config).next(card, new Date(ts), GRADE[rating]).card);
	return {
		result: next,
		trace: [
			{
				rule: 'fsrs.review',
				rating,
				stability: next.stability,
				scheduledDays: next.scheduled_days
			}
		]
	};
}

/**
 * Caps stability at `bound` days, shortening the scheduled interval and `due` to match. A state
 * already within the bound is returned unchanged.
 *
 * @see Decisions log (massed modes and fragile)
 */
export function capStability(state: FsrsCardState, bound: number): FsrsCardState {
	if (state.stability <= bound) return state;
	const scheduledDays = Math.min(
		state.scheduled_days,
		Math.max(MIN_CAPPED_INTERVAL_DAYS, Math.round(bound))
	);
	const reviewedAt = state.last_review ?? state.due - state.scheduled_days * MS_PER_DAY;
	return {
		...state,
		stability: bound,
		scheduled_days: scheduledDays,
		due: reviewedAt + scheduledDays * MS_PER_DAY
	};
}

/**
 * Predicted recall probability at time `t`, from 0 to 1. A card with no FSRS state gives 0.
 *
 * @see BUILD_PLAN §6.2
 */
export function retrievabilityAt(
	state: FsrsCardState | null,
	t: number,
	config: FsrsConfig = DEFAULT_FSRS_CONFIG
): number {
	if (state === null) return 0;
	return schedulerFor(config).retrievability(toCard(state), new Date(t));
}
