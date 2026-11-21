import type { NoteContent } from '#lib/engine/cardgen.ts';
import type { Result } from '#lib/util/result.ts';
import { fromEditFields, toEditFields, type EditableType, type EditField } from './note-edit.ts';

/** A note's type and payload, for screens (the UI never imports the engine). */
export type { NoteContent };

/** The card types Manual mode offers, as the type picker lists them (Decisions log "Phase 8.6 Q15"). */
export const MANUAL_TYPES: readonly { value: EditableType; label: string }[] = [
	{ value: 'fact', label: 'Fact (term and definition, or a list)' },
	{ value: 'keyterm', label: 'Key term' },
	{ value: 'cloze', label: 'Fill the blank' },
	{ value: 'sequence', label: 'Steps in order' },
	{ value: 'compare', label: 'Comparison table' },
	{ value: 'scenario', label: 'Scenario' },
	{ value: 'example', label: 'Worked example' }
];

/** The picture types Manual mode offers; each opens its own editor after it is made (WIP step 9). */
export const MANUAL_FIGURE_TYPES = [
	{ value: 'occlusion', label: 'Image (hide parts)' },
	{ value: 'diagram', label: 'Diagram' }
] as const;

/** A type the Manual mode picker can choose: a text type or a picture type. */
export type ManualType = EditableType | (typeof MANUAL_FIGURE_TYPES)[number]['value'];

/** Whether a picked type is a picture type (made in its own editor, not with text boxes). */
export function isFigureType(type: ManualType): type is 'occlusion' | 'diagram' {
	return type === 'occlusion' || type === 'diagram';
}

/** Empty content per type, so the add form shows the card editor's own boxes and hints. */
const BLANK: { [T in EditableType]: Extract<NoteContent, { type: T }> } = {
	keyterm: { type: 'keyterm', payload: { term: '', meaning: '' } },
	fact: { type: 'fact', payload: { term: '', definition: '' } },
	cloze: { type: 'cloze', payload: { text: '' } },
	sequence: { type: 'sequence', payload: { name: '', steps: [] } },
	example: { type: 'example', payload: { name: '', steps: [] } },
	compare: { type: 'compare', payload: { items: [], rows: [] } },
	scenario: { type: 'scenario', payload: { situation: '', answer: '' } }
};

/** The empty text boxes for a new note of this type (the same boxes as editing one). */
export function blankFields(type: EditableType): EditField[] {
	return toEditFields(BLANK[type]) ?? [];
}

/** Edge punctuation a ticked word keeps outside its stars (so "packets," gives "packets"). */
const LEAD = /^[("'“‘[]+/;
const TRAIL = /[)"'”’\].,;:!?]+$/;

/** The words of a definition, as the key-word chips show them (split on spaces). */
export function wordsOf(definition: string): string[] {
	return definition.split(/\s+/).filter(Boolean);
}

/** A word with a letter or digit in it; only these can be key words. */
const wordy = (word: string): boolean => /[\p{L}\p{N}]/u.test(word);

/**
 * The definition with its ticked words starred, the way the import writes key words: neighbouring
 * ticked words become one phrase (`*packet switching*`), and edge punctuation stays outside the
 * stars. Words without a letter or digit (a dash) can't be key words and are left as they are.
 *
 * @see PROMPTS §3 (CARD RULES: key words) and Decisions log "Phase 8.6 Q15"
 */
export function starTicked(definition: string, ticked: ReadonlySet<number>): string {
	const words = wordsOf(definition);
	const out: string[] = [];
	let run: string[] = [];
	const flush = (): void => {
		if (run.length === 0) return;
		const text = run.join(' ');
		const lead = LEAD.exec(text)?.[0] ?? '';
		const trail = TRAIL.exec(text)?.[0] ?? '';
		out.push(`${lead}*${text.slice(lead.length, text.length - trail.length)}*${trail}`);
		run = [];
	};
	words.forEach((word, index) => {
		if (ticked.has(index) && wordy(word)) {
			run.push(word);
			return;
		}
		flush();
		out.push(word);
	});
	flush();
	return out.join(' ');
}

/** A list fact's definition: every item starred, joined by ", " and a final " and ". */
export function listDefinition(items: readonly string[]): string {
	const starred = items.map((item) => `*${item}*`);
	if (starred.length < 2) return starred.join('');
	return `${starred.slice(0, -1).join(', ')} and ${starred[starred.length - 1]}`;
}

/** What the manual fact form holds: a definition with ticked key words, or a list of items. */
export type ManualFact =
	| { kind: 'definition'; term: string; definition: string; ticked: ReadonlySet<number> }
	| { kind: 'list'; term: string; items: readonly string[] };

const MIN_LIST_ITEMS = 2;

/**
 * Reads the manual fact form into a fact note's content, or says what to fix. A definition keeps
 * its ticked words as key words; a list needs at least two items (one per line) and makes a list
 * fact (no reverse card). Uses the card editor's reader, so the rules match an edit.
 *
 * @see Decisions log "Phase 8.6 Q9", "Q15"
 */
export function manualFact(form: ManualFact): Result<NoteContent, string> {
	if (form.kind === 'definition') {
		const definition = starTicked(form.definition.trim(), form.ticked);
		return fromEditFields('fact', { term: form.term, definition });
	}
	const items = form.items.map((item) => item.trim()).filter(Boolean);
	if (items.some((item) => item.includes('*'))) {
		return { ok: false, error: 'List items cannot contain *.' };
	}
	if (items.length < MIN_LIST_ITEMS) {
		return { ok: false, error: `A list needs at least ${MIN_LIST_ITEMS} items, one per line.` };
	}
	return fromEditFields('fact', { term: form.term, definition: listDefinition(items) });
}
