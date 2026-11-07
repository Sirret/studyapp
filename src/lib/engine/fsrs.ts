import { FSRS_MAXIMUM_INTERVAL_DAYS, RETENTION } from '#lib/config/defaults.ts';
import type { FsrsCardState } from '#lib/db/schemas/card.ts';
import type { Weight } from '#lib/db/schemas/common.ts';
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

/**
 * The rating for a first-attempt answer: full-weight correct → good, recognition correct → hard,
 * wrong → again. `none`-weight answers never reach FSRS (null).
 *
 * @see BUILD_PLAN §6.2
 */
export function ratingFor(weight: Weight, correct: boolean): FsrsRating | null {
	void weight;
	void correct;
	throw new Error('not implemented');
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
	void state;
	void ts;
	void rating;
	void config;
	throw new Error('not implemented');
}

/**
 * Caps stability at `bound` days, shortening the scheduled interval and `due` to match. A state
 * already within the bound is returned unchanged.
 *
 * @see Decisions log (massed modes and fragile)
 */
export function capStability(state: FsrsCardState, bound: number): FsrsCardState {
	void state;
	void bound;
	throw new Error('not implemented');
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
	void state;
	void t;
	void config;
	throw new Error('not implemented');
}
