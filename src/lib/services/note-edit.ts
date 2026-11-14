import { MIN_STEPS, type NoteType } from '#lib/db/schemas/note.ts';
import { CLOZE_SPAN, type NoteContent } from '#lib/engine/cardgen.ts';
import { readKeyWords } from '#lib/import/key-words.ts';
import { MIN_COMPARE_ITEMS } from '#lib/import/ast.ts';
import type { Result } from '#lib/util/result.ts';

/** One text box of the card editor. */
export interface EditField {
	key: string;
	label: string;
	value: string;
	/** A text area (several lines) rather than a one-line input. */
	multiline: boolean;
	/** How to write it, shown under the box. */
	hint?: string;
}

/** The note types the card list can edit as text (image notes wait for the diagram editor). */
export type EditableType = Exclude<NoteType, 'diagram' | 'occlusion'>;

const PAIR = '::';
const CELL = '|';

const lines = (text: string): string[] =>
	text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);

/** The definition with its key words starred again, the way the import wrote it. */
function starKeyWords(definition: string, keyWords: readonly string[]): string {
	let out = '';
	let rest = definition;
	for (const word of keyWords) {
		const at = rest.indexOf(word);
		if (at < 0) continue;
		out += `${rest.slice(0, at)}*${word}*`;
		rest = rest.slice(at + word.length);
	}
	return out + rest;
}

const field = (key: string, label: string, value: string, extra: Partial<EditField> = {}) => ({
	key,
	label,
	value,
	multiline: false,
	...extra
});

type ContentOf<T extends EditableType> = Extract<NoteContent, { type: T }>['payload'];
type FieldBuilders = { [T in EditableType]: (payload: ContentOf<T>) => EditField[] };

const multi = (hint?: string): Partial<EditField> => ({
	multiline: true,
	...(hint ? { hint } : {})
});

/** Each editable type's text boxes, filled from its payload. */
const FIELDS: FieldBuilders = {
	keyterm: (p) => [field('term', 'Term', p.term), field('meaning', 'Meaning', p.meaning, multi())],
	fact: (p) => [
		field('term', 'Term', p.term),
		field(
			'definition',
			'Definition',
			starKeyWords(p.definition, p.keyWords ?? []),
			multi('Put *stars* round the key words a typed answer must contain.')
		)
	],
	cloze: (p) => [
		field('text', 'Sentence', p.text, multi('Put {{double braces}} round each blank.'))
	],
	sequence: (p) => [
		field('name', 'Name', p.name),
		field('steps', 'Steps', p.steps.join('\n'), multi('One step per line, in order.'))
	],
	example: (p) => [
		field('name', 'Problem', p.name),
		field(
			'steps',
			'Steps',
			p.steps.map((s) => `${s.subgoal} ${PAIR} ${s.step}`).join('\n'),
			multi('One step per line, as: what it does :: the step.')
		)
	],
	compare: (p) => [
		field('items', 'Things compared', p.items.join('\n'), multi('One per line.')),
		field(
			'rows',
			'Rows',
			p.rows.map((r) => `${r.attribute} ${PAIR} ${r.values.join(` ${CELL} `)}`).join('\n'),
			multi('One row per line, as: attribute :: value | value (one value per thing).')
		)
	],
	scenario: (p) => [
		field('situation', 'Situation', p.situation, multi()),
		field('answer', 'Answer', p.answer, multi())
	]
};

/**
 * The text boxes that edit a note, filled with its content; `null` for image notes (occlusion,
 * diagram), which are fixed in the diagram editor instead.
 *
 * @see BUILD_PLAN §10 row 8.5 ("fix errors in place")
 */
export function toEditFields(content: NoteContent): EditField[] | null {
	if (content.type === 'diagram' || content.type === 'occlusion') return null;
	// The payload matches its type; TypeScript can't correlate the two through the table.
	const build = FIELDS[content.type] as (payload: typeof content.payload) => EditField[];
	return build(content.payload);
}

type Values = Readonly<Record<string, string>>;
type Parsed = Result<NoteContent, string>;

const ok = (content: NoteContent): Parsed => ({ ok: true, value: content });
const fail = (error: string): Parsed => ({ ok: false, error });

/** Splits `left :: right`; `null` when the line has no `::` or a side is empty. */
function splitPair(line: string): [string, string] | null {
	const at = line.indexOf(PAIR);
	if (at < 0) return null;
	const left = line.slice(0, at).trim();
	const right = line.slice(at + PAIR.length).trim();
	return left && right ? [left, right] : null;
}

function parseFact(term: string, definition: string): Parsed {
	const { text, keyWords, list } = readKeyWords(definition);
	return ok({
		type: 'fact',
		payload: {
			term,
			definition: text,
			...(keyWords.length > 0 ? { keyWords } : {}),
			...(list ? { list: true as const } : {})
		}
	});
}

function parseExample(name: string, text: string): Parsed {
	const pairs = lines(text).map(splitPair);
	if (pairs.some((pair) => pair === null))
		return fail('Write each step as: what it does :: the step.');
	const steps = pairs.flatMap((pair) => (pair ? [{ subgoal: pair[0], step: pair[1] }] : []));
	if (steps.length < MIN_STEPS) return fail(`A worked example needs at least ${MIN_STEPS} steps.`);
	return ok({ type: 'example', payload: { name, steps } });
}

function parseCompare(itemsText: string, rowsText: string): Parsed {
	const items = lines(itemsText);
	if (items.length < MIN_COMPARE_ITEMS) {
		return fail(`Compare at least ${MIN_COMPARE_ITEMS} things, one per line.`);
	}
	const rows: { attribute: string; values: string[] }[] = [];
	for (const line of lines(rowsText)) {
		const pair = splitPair(line);
		const values = pair?.[1].split(CELL).map((v) => v.trim()) ?? [];
		if (!pair || values.length !== items.length || values.some((v) => v === '')) {
			return fail(`Each row needs an attribute, then :: and ${items.length} values split by |.`);
		}
		rows.push({ attribute: pair[0], values });
	}
	if (rows.length === 0) return fail('Add at least one row.');
	return ok({ type: 'compare', payload: { items, rows } });
}

type Get = (key: string) => string;

function parseCloze(text: string): Parsed {
	if ((text.match(CLOZE_SPAN) ?? []).length === 0) {
		return fail('Put {{double braces}} round at least one blank.');
	}
	return ok({ type: 'cloze', payload: { text } });
}

function parseSequence(name: string, text: string): Parsed {
	const steps = lines(text);
	if (steps.length < MIN_STEPS) return fail(`A sequence needs at least ${MIN_STEPS} steps.`);
	return ok({ type: 'sequence', payload: { name, steps } });
}

/** Each editable type's reader. */
const PARSERS: Record<EditableType, (get: Get) => Parsed> = {
	keyterm: (get) =>
		ok({ type: 'keyterm', payload: { term: get('term'), meaning: get('meaning') } }),
	fact: (get) => parseFact(get('term'), get('definition')),
	cloze: (get) => parseCloze(get('text')),
	sequence: (get) => parseSequence(get('name'), get('steps')),
	example: (get) => parseExample(get('name'), get('steps')),
	compare: (get) => parseCompare(get('items'), get('rows')),
	scenario: (get) =>
		ok({ type: 'scenario', payload: { situation: get('situation'), answer: get('answer') } })
};

/**
 * Reads the editor's text boxes back into a note's content, or says in plain words what to fix.
 * Every box is required; the shape rules match the import (steps ≥ `MIN_STEPS`, a cloze has a
 * blank, a comparison row has one value per thing).
 *
 * @see BUILD_PLAN §10 row 8.5
 * @see DATA_MODEL §4.2
 */
export function fromEditFields(type: EditableType, values: Values): Parsed {
	if (Object.values(values).some((value) => value.trim() === '')) return fail('Fill in every box.');
	return PARSERS[type]((key) => (values[key] ?? '').trim());
}
