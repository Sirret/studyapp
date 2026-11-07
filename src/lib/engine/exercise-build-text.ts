import { MATCHING_PAIRS } from '#lib/config/defaults.ts';
import type { CardId, ExerciseKind } from '#lib/db/schemas/common.ts';
import { pickDistractors, firstLetterBank } from './distractors.ts';
import {
	acceptedOf,
	baseOf,
	fallback,
	promptOfCard,
	shuffled,
	toOption,
	type BuildContext,
	type Built
} from './exercise-context.ts';
import { clozeText, flipAnswer, titleOf, variantIndexes } from './exercise-prompts.ts';
import type { ChecklistItem, ExerciseNote } from './exercise-types.ts';
import { normalizeAnswer } from './grading.ts';
import { compareText } from './replay.ts';

/** Typed recall (`cloze`, `firstLetterType`). @see BUILD_PLAN §5.1 */
export function buildTyped(ctx: BuildContext, kind: ExerciseKind): Built {
	if (!ctx.answer) return fallback('flip', 'no text answer');
	const letter =
		kind === 'firstLetterType' ? ([...normalizeAnswer(ctx.answer.text)][0] ?? '') : null;
	const others = ctx.pool
		.filter((entry) => entry.cardId !== ctx.input.card.id)
		.map((entry) => ({ cardId: entry.cardId, text: entry.text }));
	const otherPrompts: Partial<Record<CardId, string>> = {};
	for (const other of others) otherPrompts[other.cardId] = promptOfCard(ctx, other.cardId);
	return {
		...baseOf(ctx, kind),
		shape: 'type',
		answer: ctx.answer.text,
		accepted: acceptedOf(ctx),
		others,
		otherPrompts,
		letter,
		context: []
	};
}

function choiceInput(ctx: BuildContext) {
	if (!ctx.entry) throw new Error('choice without a text answer');
	return {
		target: ctx.entry,
		accepted: acceptedOf(ctx),
		pool: ctx.pool,
		confusions: ctx.input.confusions,
		rng: ctx.rng
	};
}

/** `mc`, `pretest`, and the sibling-option forms of `whichOne` and `scenario`. */
export function buildChoice(ctx: BuildContext, kind: ExerciseKind): Built {
	const noOptions: ExerciseKind = kind === 'pretest' ? 'flip' : kind === 'mc' ? 'cloze' : 'mc';
	if (!ctx.entry) return fallback(kind === 'pretest' ? 'flip' : noOptions, 'no text answer');
	const { options, correctIndex } = pickDistractors(choiceInput(ctx)).result;
	if (options.length < 2) return fallback(noOptions, 'no distractor');
	return {
		...baseOf(ctx, kind),
		shape: 'choose',
		options: options.map((option) => toOption(ctx, option)),
		correctIndex,
		letter: null
	};
}

/** First-letter bank. @see BUILD_PLAN §6.10 */
export function buildFirstLetterBank(ctx: BuildContext): Built {
	if (!ctx.entry) return fallback('flip', 'no text answer');
	const { letter, bank } = firstLetterBank(choiceInput(ctx)).result;
	if (!bank) return fallback('firstLetterType', 'fewer than 3 same-letter candidates');
	return {
		...baseOf(ctx, 'firstLetterBank'),
		shape: 'choose',
		options: bank.options.map((option) => toOption(ctx, option)),
		correctIndex: bank.correctIndex,
		letter
	};
}

/** `whichOne` / `scenario` on `which:r`: the note's items as options. */
export function buildItemChoice(ctx: BuildContext, kind: ExerciseKind): Built {
	if (ctx.note.type !== 'compare' || ctx.prompt.item === undefined)
		return fallback('mc', 'no items');
	const { items, at } = shuffled(ctx.note.payload.items, ctx.rng);
	return {
		...baseOf(ctx, kind),
		shape: 'choose',
		options: items.map((text) => ({ text })),
		correctIndex: at[ctx.prompt.item] ?? 0,
		letter: null
	};
}

/** `whichOne`: steps as options for `step:i`, items for `which:r`. */
export function buildWhichOne(ctx: BuildContext): Built {
	const { variant } = ctx.input.card;
	if (variantIndexes(variant, 'which')) return buildItemChoice(ctx, 'whichOne');
	if (variantIndexes(variant, 'step')) return buildChoice(ctx, 'whichOne');
	return fallback('mc', 'whichOne needs step:i or which:r');
}

/** `scenario`: siblings for a scenario note, items for `which:r`. */
export function buildScenario(ctx: BuildContext): Built {
	if (variantIndexes(ctx.input.card.variant, 'which')) return buildItemChoice(ctx, 'scenario');
	if (ctx.note.type === 'scenario') return buildChoice(ctx, 'scenario');
	return fallback('mc', 'scenario needs a scenario note or which:r');
}

function pairOf(note: ExerciseNote): [string, string] | null {
	if (note.type === 'keyterm') return [note.payload.term, note.payload.meaning];
	if (note.type === 'fact') return [note.payload.term, note.payload.definition];
	return null;
}

/** `matching`: the card's pair plus pairs of the same topic, then the course. */
export function buildMatching(ctx: BuildContext): Built {
	const own = pairOf(ctx.note);
	if (!own) return fallback('mc', 'matching needs a keyterm or fact');
	const others = [...ctx.input.course.notes.values()]
		.filter((note) => note.id !== ctx.note.id && pairOf(note))
		.sort(
			(a, b) =>
				Number(a.topicId !== ctx.note.topicId) - Number(b.topicId !== ctx.note.topicId) ||
				compareText(a.topicId, b.topicId) ||
				a.order - b.order ||
				compareText(a.id, b.id)
		)
		.slice(0, MATCHING_PAIRS - 1)
		.map((note) => pairOf(note) as [string, string]);
	if (others.length === 0) return fallback('mc', 'no other pair');
	const pairs = [own, ...others];
	const { items: right, at } = shuffled(
		pairs.map(([, meaning]) => meaning),
		ctx.rng
	);
	return {
		...baseOf(ctx, 'matching'),
		shape: 'pair',
		left: pairs.map(([term]) => term),
		right,
		pairs: pairs.map((_pair, i) => at[i] ?? 0)
	};
}

/** `flip`: recall, reveal, rate. */
export function buildFlip(ctx: BuildContext): Built {
	const item = ctx.prompt.item;
	const itemAnswer =
		ctx.note.type === 'compare' && item !== undefined ? ctx.note.payload.items[item] : undefined;
	const answer = flipAnswer(ctx.note, ctx.input.card.variant) ?? itemAnswer ?? '';
	return { ...baseOf(ctx, 'flip'), shape: 'selfRate', answer, checklist: [] };
}

/** `explainIt`: a cloze note with every span hidden; the spans are the checklist. */
export function buildExplainIt(ctx: BuildContext): Built {
	if (ctx.note.type !== 'cloze') return fallback('flip', 'explainIt needs a cloze note');
	const spans = ctx.pool.filter((entry) => entry.noteId === ctx.note.id).map((entry) => entry.text);
	return {
		...baseOf(ctx, 'explainIt', clozeText(ctx.note.payload.text, -1)),
		shape: 'selfRate',
		answer: clozeText(ctx.note.payload.text, -2),
		checklist: spans.map((text) => ({ text }))
	};
}

/** `blurt`: recall a note; the checklist is its cards' answers. */
export function buildBlurt(ctx: BuildContext): Built {
	const checklist: ChecklistItem[] = ctx.pool
		.filter((entry) => entry.noteId === ctx.note.id)
		.map((entry) => ({ text: entry.text, cardId: entry.cardId }));
	if (checklist.length === 0) return fallback('flip', 'no text answers to tick');
	return {
		...baseOf(ctx, 'blurt', `Recall everything you can about ${titleOf(ctx.note)}`),
		shape: 'selfRate',
		answer: checklist.map((item) => item.text).join('\n'),
		checklist
	};
}
