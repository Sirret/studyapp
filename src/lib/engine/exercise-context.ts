import type { CardId, ExerciseKind } from '#lib/db/schemas/common.ts';
import { answerEntries, type AnswerEntry, type CardAnswer } from './answers.ts';
import type { ChoiceOption } from './distractors.ts';
import { promptFor } from './exercise-prompts.ts';
import type {
	ExerciseInput,
	ExerciseNote,
	ExerciseSpec,
	SpecBase,
	SpecOption
} from './exercise-types.ts';
import { createRng, shuffle, type Rng } from './rng.ts';
import { cardAnswer } from './answers.ts';

/** A built spec, or the kind to fall back to and why. */
export type Built = ExerciseSpec | { fallback: ExerciseKind; reason: string };

/** What every builder reads, computed once per build. */
export interface BuildContext {
	input: ExerciseInput;
	note: ExerciseNote;
	answer: CardAnswer | null;
	/** The card's own answer entry, when it has a text answer. */
	entry: AnswerEntry | undefined;
	/** The card's prompt; its RNG draw (for `which:r`) happens first. */
	prompt: { text: string; item?: number };
	/** Every text answer of the course. */
	pool: AnswerEntry[];
	rng: Rng;
}

/** The one line telling the student what to do, per kind. @see BUILD_PLAN §5.1 */
const INSTRUCTIONS: Partial<Record<ExerciseKind, string>> = {
	cloze: 'Type the answer',
	firstLetterType: 'Type the answer; it starts with the letter shown',
	firstLetterBank: 'Pick the answer',
	mc: 'Pick the answer',
	pretest: 'Take a guess. It’s fine to be wrong',
	whichOne: 'Pick the right one',
	scenario: 'Pick the one that fits',
	oddOneOut: 'Pick the one that doesn’t belong',
	multiSelect: 'Select all that apply',
	pickPrinciple: 'What is this difference about?',
	tableRow: 'Match each to its value',
	categorize: 'Sort each into its group',
	sequence: 'Put the steps in order',
	parsons: 'Put the steps in order; some don’t belong',
	subgoalMatch: 'Match each step to its goal',
	fadeStep: 'Type the missing step',
	newInstance: 'Type the step',
	exampleStudy: 'Read the worked example',
	matching: 'Match the pairs',
	flip: 'Recall it, then reveal',
	explainIt: 'Explain it to yourself, then reveal',
	blurt: 'Recall everything, then tick what you got'
};

/** A fixed RNG for prompts of other cards, which never draw for anything but `which:r`. */
const PROMPT_RNG = createRng(0);

export function makeContext(input: ExerciseInput): BuildContext {
	const note = input.course.notes.get(input.card.noteId);
	if (!note) throw new Error(`Card ${input.card.id} has no note`);
	const prompt = promptFor(note, input.card.variant, input.rng);
	const pool = answerEntries(input.course.cards, input.course.notes);
	return {
		input,
		note,
		answer: cardAnswer(note, input.card.variant),
		entry: pool.find((entry) => entry.cardId === input.card.id),
		prompt,
		pool,
		rng: input.rng
	};
}

export function fallback(kind: ExerciseKind, reason: string): Built {
	return { fallback: kind, reason };
}

/** The fields every spec shares. */
export function baseOf(ctx: BuildContext, kind: ExerciseKind, prompt = ctx.prompt.text): SpecBase {
	return { kind, cardId: ctx.input.card.id, prompt, instruction: INSTRUCTIONS[kind] ?? '' };
}

/** Another card's prompt, for contrastive feedback. */
export function promptOfCard(ctx: BuildContext, cardId: CardId): string | undefined {
	const card = ctx.input.course.cards.find((candidate) => candidate.id === cardId);
	const note = card && ctx.input.course.notes.get(card.noteId);
	return card && note ? promptFor(note, card.variant, PROMPT_RNG).text : undefined;
}

/** An option for the student; one from another card names that card and its prompt. */
export function toOption(ctx: BuildContext, option: ChoiceOption): SpecOption {
	if (option.cardId === ctx.input.card.id) return { text: option.text };
	const answers = promptOfCard(ctx, option.cardId);
	return {
		text: option.text,
		cardId: option.cardId,
		...(answers === undefined ? {} : { answers })
	};
}

/** Texts in a seeded order, and where each original index landed. */
export function shuffled(texts: readonly string[], rng: Rng): { items: string[]; at: number[] } {
	const order = shuffle(
		texts.map((_text, i) => i),
		rng
	);
	const at: number[] = [];
	order.forEach((original, position) => (at[original] = position));
	return { items: order.map((i) => texts[i] as string), at };
}

/** The note's accept list for this card's variant. */
export function acceptedOf(ctx: BuildContext): string[] {
	return ctx.note.accept[ctx.input.card.variant] ?? [];
}
