import { PARSONS_EXTRAS } from '#lib/config/defaults.ts';
import type { NoteId } from '#lib/db/schemas/common.ts';
import { baseOf, fallback, shuffled, type BuildContext, type Built } from './exercise-context.ts';
import type { ExerciseNote } from './exercise-types.ts';
import { normalizeAnswer } from './grading.ts';

type ExampleNote = Extract<ExerciseNote, { type: 'example' }>;

/** The ordered steps of a sequence or example note, else null. */
function stepsOf(note: ExerciseNote): string[] | null {
	if (note.type === 'sequence') return [...note.payload.steps];
	if (note.type === 'example') return note.payload.steps.map((step) => step.step);
	return null;
}

function exampleOf(ctx: BuildContext): ExampleNote | null {
	return ctx.note.type === 'example' ? ctx.note : null;
}

function orderSpec(
	ctx: BuildContext,
	kind: 'sequence' | 'parsons',
	steps: string[],
	extras: string[]
): Built {
	const { items, at } = shuffled([...steps, ...extras], ctx.rng);
	const prompt =
		ctx.note.type === 'example'
			? `Put the steps of ${ctx.note.payload.name} in order`
			: ctx.prompt.text;
	return {
		...baseOf(ctx, kind, prompt),
		shape: 'order',
		items,
		correctOrder: steps.map((_step, i) => at[i] ?? 0),
		extras: extras.map((_step, i) => at[steps.length + i] ?? 0)
	};
}

/** `sequence`: put the steps in order. @see BUILD_PLAN §5.1 */
export function buildSequence(ctx: BuildContext): Built {
	const steps = stepsOf(ctx.note);
	if (!steps) return fallback('flip', 'no steps');
	return orderSpec(ctx, 'sequence', steps, []);
}

/** Steps of the course's other sequence and example notes, in course card order. */
function foreignSteps(ctx: BuildContext, steps: readonly string[]): string[] {
	const seen = new Set(steps.map(normalizeAnswer));
	const notes: NoteId[] = [];
	for (const card of ctx.input.course.cards) {
		if (card.noteId !== ctx.note.id && !notes.includes(card.noteId)) notes.push(card.noteId);
	}
	const extras: string[] = [];
	for (const noteId of notes) {
		const note = ctx.input.course.notes.get(noteId);
		for (const step of (note && stepsOf(note)) ?? []) {
			const key = normalizeAnswer(step);
			if (extras.length < PARSONS_EXTRAS && !seen.has(key)) extras.push(step);
			seen.add(key);
		}
	}
	return extras;
}

/** `parsons`: the steps plus extras that don't belong. @see BUILD_PLAN §5.1 */
export function buildParsons(ctx: BuildContext): Built {
	const steps = stepsOf(ctx.note);
	if (!steps) return fallback('flip', 'no steps');
	const extras = foreignSteps(ctx, steps);
	if (extras.length === 0) return fallback('sequence', 'no extra step available');
	return orderSpec(ctx, 'parsons', steps, extras);
}

/** `subgoalMatch`: match each step to its subgoal. @see BUILD_PLAN §5.1 */
export function buildSubgoalMatch(ctx: BuildContext): Built {
	const note = exampleOf(ctx);
	if (!note) return fallback('flip', 'needs an example');
	const { items: right, at } = shuffled(
		note.payload.steps.map((step) => step.subgoal),
		ctx.rng
	);
	return {
		...baseOf(ctx, 'subgoalMatch'),
		shape: 'pair',
		left: note.payload.steps.map((step) => step.step),
		right,
		pairs: note.payload.steps.map((_step, i) => at[i] ?? 0)
	};
}

function askStep(
	ctx: BuildContext,
	note: ExampleNote,
	kind: 'fadeStep' | 'newInstance',
	index: number,
	context: string[]
): Built {
	const steps = note.payload.steps;
	const asked = steps[index] ?? { subgoal: '', step: '' };
	const others = steps
		.filter((_step, i) => i !== index)
		.map((step) => ({ cardId: ctx.input.card.id, text: step.step }));
	return {
		...baseOf(ctx, kind, `${note.payload.name} — ${asked.subgoal}: what's the step?`),
		shape: 'type',
		answer: asked.step,
		accepted: [],
		others,
		otherPrompts: {},
		letter: null,
		context
	};
}

/**
 * `fadeStep`: fade k shows the first n−k steps and asks for step n−k; later steps stay hidden.
 *
 * @see BUILD_PLAN §5.1 (`fadeStep`)
 */
export function buildFadeStep(ctx: BuildContext): Built {
	const note = exampleOf(ctx);
	if (!note) return fallback('cloze', 'needs an example');
	const { path, step } = ctx.input.card;
	const k = Math.max(1, path.slice(0, step + 1).filter((kind) => kind === 'fadeStep').length);
	const index = Math.max(0, note.payload.steps.length - k);
	const context = note.payload.steps.slice(0, index).map((s) => `${s.subgoal}: ${s.step}`);
	return askStep(ctx, note, 'fadeStep', index, context);
}

/** `newInstance`: the step of one seeded subgoal. @see BUILD_PLAN §5.1 */
export function buildNewInstance(ctx: BuildContext): Built {
	const note = exampleOf(ctx);
	if (!note) return fallback('cloze', 'needs an example');
	const index = Math.floor(ctx.rng() * note.payload.steps.length);
	return askStep(ctx, note, 'newInstance', index, []);
}

/** `exampleStudy`: the whole worked example, once. @see BUILD_PLAN §5.1 */
export function buildExampleStudy(ctx: BuildContext): Built {
	const note = exampleOf(ctx);
	if (!note) return fallback('flip', 'needs an example');
	return {
		...baseOf(ctx, 'exampleStudy'),
		shape: 'study',
		steps: note.payload.steps.map(({ subgoal, step }) => ({ subgoal, step }))
	};
}
