import type { ExerciseKind } from '#lib/db/schemas/common.ts';
import { currentKind } from './exercise-kinds.ts';
import {
	buildBlurt,
	buildChoice,
	buildExplainIt,
	buildFirstLetterBank,
	buildFlip,
	buildMatching,
	buildScenario,
	buildTyped,
	buildWhichOne
} from './exercise-build-text.ts';
import {
	buildCategorize,
	buildMultiSelect,
	buildOddOneOut,
	buildPickPrinciple,
	buildTableRow
} from './exercise-build-compare.ts';
import {
	buildExampleStudy,
	buildFadeStep,
	buildNewInstance,
	buildParsons,
	buildSequence,
	buildSubgoalMatch
} from './exercise-build-steps.ts';
import { fallback, makeContext, type BuildContext, type Built } from './exercise-context.ts';
import type { ExerciseInput, ExerciseSpec, KindInput } from './exercise-types.ts';
import type { TraceEntry, Traced } from './trace.ts';

export { promptFor } from './exercise-prompts.ts';
export type * from './exercise-types.ts';

/**
 * The kind to show: `currentKind`, except that a `cloze` step becomes `firstLetterBank` in
 * first-letter spelling mode or right after a missed typed answer.
 *
 * @see BUILD_PLAN §5.1 (choosing the kind) and §6.10 (first-letter mode)
 */
export function exerciseKindFor(input: KindInput): ExerciseKind {
	const kind = currentKind(input.path, input.pathStep, input.accuracy);
	const firstLetter = input.spellingMode === 'firstLetter' || input.missedTyped;
	return kind === 'cloze' && firstLetter ? 'firstLetterBank' : kind;
}

/** Kinds that need a drawn diagram or image come in Phase 6; until then they fall back. */
function diagramFallback(to: ExerciseKind): Built {
	return fallback(to, 'diagram kinds come with the diagram view (Phase 6)');
}

type Builder = (ctx: BuildContext) => Built;

/** One builder per kind; `Record` keeps it exhaustive. @see BUILD_PLAN §5.1 */
const BUILDERS: Readonly<Record<ExerciseKind, Builder>> = {
	cloze: (ctx) => buildTyped(ctx, 'cloze'),
	firstLetterType: (ctx) => buildTyped(ctx, 'firstLetterType'),
	firstLetterBank: buildFirstLetterBank,
	mc: (ctx) => buildChoice(ctx, 'mc'),
	pretest: (ctx) => buildChoice(ctx, 'pretest'),
	whichOne: buildWhichOne,
	scenario: buildScenario,
	oddOneOut: buildOddOneOut,
	multiSelect: buildMultiSelect,
	pickPrinciple: buildPickPrinciple,
	tableRow: buildTableRow,
	categorize: buildCategorize,
	sequence: buildSequence,
	parsons: buildParsons,
	subgoalMatch: buildSubgoalMatch,
	fadeStep: buildFadeStep,
	newInstance: buildNewInstance,
	exampleStudy: buildExampleStudy,
	matching: buildMatching,
	flip: buildFlip,
	explainIt: buildExplainIt,
	blurt: buildBlurt,
	occlusionType: () => diagramFallback('cloze'),
	occlusionDrag: () => diagramFallback('cloze'),
	occlusionBank: () => diagramFallback('mc'),
	hotspot: () => diagramFallback('flip'),
	structureRebuild: () => diagramFallback('flip'),
	layerOrder: () => diagramFallback('flip'),
	nodeCloze: () => diagramFallback('cloze'),
	edgeCloze: () => diagramFallback('cloze'),
	redraw: () => diagramFallback('flip')
};

/** Fallbacks never loop: each chain ends at `flip`, which always builds. */
const MAX_FALLBACKS = 6;

/**
 * Builds what to show for the card: shuffled with the seeded RNG, falling back to another kind
 * when this one can't be built for the card. The spec's `kind` is the kind really shown.
 *
 * @see BUILD_PLAN §5.1
 */
export function buildExercise(input: ExerciseInput): Traced<ExerciseSpec> {
	const ctx = makeContext(input);
	const trace: TraceEntry[] = [];
	let kind = input.kind;
	for (let i = 0; i <= MAX_FALLBACKS; i += 1) {
		const built = BUILDERS[kind](ctx);
		if (!('fallback' in built)) {
			trace.push({ rule: 'exercise.build', requested: input.kind, kind, cardId: input.card.id });
			return { result: built, trace };
		}
		trace.push({ rule: 'exercise.fallback', from: kind, to: built.fallback, reason: built.reason });
		kind = built.fallback;
	}
	throw new Error(`No exercise could be built for card ${input.card.id}`);
}
