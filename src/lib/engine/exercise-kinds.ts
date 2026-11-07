import { MC_UNTIL_ACCURACY } from '#lib/config/defaults.ts';
import type { ExerciseKind, Weight } from '#lib/db/schemas/common.ts';

/** The groups of BUILD_PLAN §3.3. */
export type ExerciseGroup =
	'recall' | 'arrange' | 'discriminate' | 'choose' | 'warmup' | 'selfRated';

const WEIGHT_OF_GROUP: Readonly<Record<ExerciseGroup, Weight>> = {
	recall: 'full',
	arrange: 'full',
	discriminate: 'full',
	choose: 'recognition',
	warmup: 'none',
	selfRated: 'none'
};

/** Kinds per group, in the §3.3 table order. */
const KINDS_BY_GROUP: Readonly<Record<ExerciseGroup, readonly ExerciseKind[]>> = {
	recall: ['cloze', 'firstLetterType', 'fadeStep', 'newInstance'],
	arrange: [
		'sequence',
		'parsons',
		'subgoalMatch',
		'occlusionType',
		'occlusionDrag',
		'structureRebuild',
		'layerOrder',
		'nodeCloze',
		'edgeCloze'
	],
	discriminate: ['categorize', 'oddOneOut', 'whichOne', 'scenario', 'tableRow', 'pickPrinciple'],
	choose: ['mc', 'multiSelect', 'occlusionBank', 'firstLetterBank'],
	warmup: ['matching', 'hotspot', 'pretest'],
	selfRated: ['flip', 'explainIt', 'blurt', 'redraw', 'exampleStudy']
};

type ExerciseInfo = { group: ExerciseGroup; weight: Weight };

/** Group and weight of every exercise kind. @see BUILD_PLAN §3.3 */
export const EXERCISES = Object.fromEntries(
	Object.entries(KINDS_BY_GROUP).flatMap(([group, kinds]) =>
		kinds.map((kind) => [
			kind,
			{ group: group as ExerciseGroup, weight: WEIGHT_OF_GROUP[group as ExerciseGroup] }
		])
	)
) as Readonly<Record<ExerciseKind, ExerciseInfo>>;

/** Steps a card skips once its accuracy reaches `MC_UNTIL_ACCURACY`. @see BUILD_PLAN §5 */
const MC_GATED: ReadonlySet<ExerciseKind> = new Set(['mc', 'occlusionBank']);

/** Worked-example kinds, which open the "new material" phase in this order. @see CONCEPT §6 */
export const WORKED_EXAMPLE_KINDS: readonly ExerciseKind[] = ['exampleStudy', 'fadeStep'];

/**
 * The order kinds are grouped in inside a session phase: worked examples first, then the §3.3
 * table order.
 *
 * @see BUILD_PLAN §6.4 and Decisions log (session phases)
 */
export const PHASE_KIND_ORDER: readonly ExerciseKind[] = [
	...WORKED_EXAMPLE_KINDS,
	...Object.values(KINDS_BY_GROUP)
		.flat()
		.filter((kind) => !WORKED_EXAMPLE_KINDS.includes(kind))
];

/** The weight an answer of this kind carries. @see BUILD_PLAN §3.3 */
export function weightOf(kind: ExerciseKind): Weight {
	return EXERCISES[kind].weight;
}

/** The §3.3 group of this kind. @see BUILD_PLAN §3.3 */
export function groupOf(kind: ExerciseKind): ExerciseGroup {
	return EXERCISES[kind].group;
}

function accuracyRate({ n, correct }: { n: number; correct: number }): number {
	return n === 0 ? 0 : correct / n;
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
	return path[currentStep(path, pathStep, accuracy)] as ExerciseKind;
}

/**
 * The path index `currentKind` shows: `pathStep` clamped, past any gated `mc`/`occlusionBank`
 * steps. Exercises that depend on where the card is in its path (fade k) read this.
 *
 * @see BUILD_PLAN §5 and §5.1 (`fadeStep`)
 */
export function currentStep(
	path: readonly ExerciseKind[],
	pathStep: number,
	accuracy: { n: number; correct: number }
): number {
	const last = path.length - 1;
	let step = Math.min(Math.max(pathStep, 0), last);
	const skipChoose = accuracyRate(accuracy) >= MC_UNTIL_ACCURACY;
	while (skipChoose && step < last && MC_GATED.has(path[step] as ExerciseKind)) step += 1;
	return step;
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
	const found = path.indexOf(kind, pathStep);
	if (found === -1) return pathStep;
	return Math.min(found + 1, path.length - 1);
}
