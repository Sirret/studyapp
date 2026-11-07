import { BLURT_TITLE_CHARS } from '#lib/config/defaults.ts';
import { assertNever } from '#lib/util/result.ts';
import { cardAnswer, type AnswerNote } from './answers.ts';
import { CLOZE_SPAN } from './cardgen.ts';
import type { Rng } from './rng.ts';

/** The blank shown in place of a hidden answer. */
export const BLANK = '_____';

type NoteOf<T extends AnswerNote['type']> = Extract<AnswerNote, { type: T }>;

/** `prefix:a:b…` as numbers, or null. */
export function variantIndexes(variant: string, prefix: string): number[] | null {
	const [head, ...rest] = variant.split(':');
	if (head !== prefix || rest.length === 0 || !rest.every((part) => /^\d+$/.test(part)))
		return null;
	return rest.map(Number);
}

/** Cloze text with span `hidden` (0-based) blanked and the others filled; −1 blanks every span. */
export function clozeText(text: string, hidden: number): string {
	let index = -1;
	return text.replace(CLOZE_SPAN, (_match, inner: string) => {
		index += 1;
		return hidden === -1 || index === hidden ? BLANK : inner.trim();
	});
}

function attributeOf(note: NoteOf<'compare'>, r: number): string {
	return note.payload.rows[r]?.attribute ?? '';
}

function valueOf(note: NoteOf<'compare'>, r: number, c: number): string {
	return note.payload.rows[r]?.values[c] ?? '';
}

function whichPrompt(note: NoteOf<'compare'>, r: number, rng: Rng): { text: string; item: number } {
	const item = Math.floor(rng() * note.payload.items.length);
	return { text: `Which one has ${attributeOf(note, r)}: ${valueOf(note, r, item)}?`, item };
}

function comparePrompt(
	note: NoteOf<'compare'>,
	variant: string,
	rng: Rng
): { text: string; item?: number } {
	const cell = variantIndexes(variant, 'cell');
	if (cell && cell.length === 2) {
		const [r, c] = cell as [number, number];
		return { text: `${note.payload.items[c] ?? ''} — ${attributeOf(note, r)}` };
	}
	const row = variantIndexes(variant, 'row');
	if (row) return { text: `${attributeOf(note, row[0] as number)}: match each to its value` };
	return whichPrompt(note, variantIndexes(variant, 'which')?.[0] ?? 0, rng);
}

function sequencePrompt(note: NoteOf<'sequence'>, variant: string): string {
	const step = variantIndexes(variant, 'step')?.[0];
	const { name, steps } = note.payload;
	return step === undefined
		? `Put the steps of ${name} in order`
		: `${name}: what comes after "${steps[step] ?? ''}"?`;
}

function clozePrompt(text: string, variant: string): string {
	return clozeText(text, Number(/^c(\d+)$/.exec(variant)?.[1] ?? 1) - 1);
}

function factPrompt(note: NoteOf<'fact'>, variant: string): string {
	return variant === 'rev' ? note.payload.definition : note.payload.term;
}

function occlusionPrompt(note: NoteOf<'occlusion'>, variant: string): string {
	return cardAnswer(note, variant)?.text ?? '';
}

function textPrompt(note: Exclude<AnswerNote, NoteOf<'compare'>>, variant: string): string {
	switch (note.type) {
		case 'keyterm':
			return note.payload.meaning;
		case 'fact':
			return factPrompt(note, variant);
		case 'cloze':
			return clozePrompt(note.payload.text, variant);
		case 'sequence':
			return sequencePrompt(note, variant);
		case 'example':
		case 'diagram':
			return note.payload.name;
		case 'scenario':
			return note.payload.situation;
		case 'occlusion':
			return occlusionPrompt(note, variant);
		default:
			return assertNever(note);
	}
}

/**
 * A card's question text. For `which:r` the item is chosen with the first draw of `rng`, and
 * returned as `item`.
 *
 * @see BUILD_PLAN §5.1 (prompts)
 */
export function promptFor(
	note: AnswerNote,
	variant: string,
	rng: Rng
): { text: string; item?: number } {
	return note.type === 'compare'
		? comparePrompt(note, variant, rng)
		: { text: textPrompt(note, variant) };
}

/** A short title for a note, used by blurt. @see BUILD_PLAN §5.1 (`blurt`) */
export function titleOf(note: AnswerNote): string {
	switch (note.type) {
		case 'keyterm':
		case 'fact':
			return note.payload.term;
		case 'sequence':
		case 'example':
		case 'diagram':
			return note.payload.name;
		case 'scenario':
			return note.payload.situation;
		case 'cloze':
			return clozeText(note.payload.text, -2).slice(0, BLURT_TITLE_CHARS);
		case 'compare':
			return note.payload.items.join(' vs ').slice(0, BLURT_TITLE_CHARS);
		case 'occlusion':
			return note.payload.boxes
				.map((box) => box.label)
				.join(', ')
				.slice(0, BLURT_TITLE_CHARS);
		default:
			return assertNever(note);
	}
}

function rowLines(note: NoteOf<'compare'>, variant: string): string | null {
	const row = variantIndexes(variant, 'row')?.[0];
	if (row === undefined) return null;
	return note.payload.items.map((item, c) => `${item}: ${valueOf(note, row, c)}`).join('\n');
}

/**
 * What a flip card reveals: the text answer, or for order and row cards one line per part.
 *
 * @see BUILD_PLAN §5.1 (`flip`)
 */
export function flipAnswer(note: AnswerNote, variant: string): string | null {
	const text = cardAnswer(note, variant)?.text;
	if (text !== undefined) return text;
	if (note.type === 'sequence') return note.payload.steps.join('\n');
	if (note.type === 'example') return note.payload.steps.map((step) => step.step).join('\n');
	return note.type === 'compare' ? rowLines(note, variant) : null;
}
