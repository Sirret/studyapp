import type { ExerciseKind, Weight } from '#lib/db/schemas/common.ts';

/** The groups of BUILD_PLAN §3.3. */
export type ExerciseGroup =
	'recall' | 'arrange' | 'discriminate' | 'choose' | 'warmup' | 'selfRated';

/** Group and weight of every exercise kind. @see BUILD_PLAN §3.3 */
export const EXERCISES: Readonly<Record<ExerciseKind, { group: ExerciseGroup; weight: Weight }>> =
	{} as Readonly<Record<ExerciseKind, { group: ExerciseGroup; weight: Weight }>>;

/**
 * The order kinds are grouped in inside a session phase: worked examples first, then the §3.3
 * table order.
 *
 * @see BUILD_PLAN §6.4 and Decisions log (session phases)
 */
export const PHASE_KIND_ORDER: readonly ExerciseKind[] = [];

/** The weight an answer of this kind carries. @see BUILD_PLAN §3.3 */
export function weightOf(kind: ExerciseKind): Weight {
	void kind;
	throw new Error('not implemented');
}

/** The §3.3 group of this kind. @see BUILD_PLAN §3.3 */
export function groupOf(kind: ExerciseKind): ExerciseGroup {
	void kind;
	throw new Error('not implemented');
}

/**
 * The kind to show next: the path step at `pathStep`, skipping `mc` and `occlusionBank` steps once
 * first-attempt accuracy reaches `MC_UNTIL_ACCURACY` (no attempts counts as 0). The last step is
 * never skipped.
 *
 * @see BUILD_PLAN §5 and Decisions log (pathStep)
 */
export function currentKind(
	path: readonly ExerciseKind[],
	pathStep: number,
	accuracy: { n: number; correct: number }
): ExerciseKind {
	void path;
	void pathStep;
	void accuracy;
	throw new Error('not implemented');
}

/**
 * The path step after completing `kind`: one past the first step at or after `pathStep` with that
 * kind, clamped to the last step. A kind not found there leaves `pathStep` unchanged.
 *
 * @see Decisions log (pathStep)
 */
export function advancePathStep(
	path: readonly ExerciseKind[],
	pathStep: number,
	kind: ExerciseKind
): number {
	void path;
	void pathStep;
	void kind;
	throw new Error('not implemented');
}
