import type { CardId, NoteId, TopicId } from '#lib/db/schemas/common.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import { assertNever } from '#lib/util/result.ts';
import { clozeAnswers } from './cardgen.ts';

/** Which answers can stand in for each other as options. @see BUILD_PLAN Decisions log */
export type AnswerKind = 'term' | 'definition' | 'step';

/** The text a card asks for. @see BUILD_PLAN Decisions log (cardAnswer) */
export interface CardAnswer {
	text: string;
	kind: AnswerKind;
	/** Cards whose answers are siblings (same attribute, same sequence…); absent when none. */
	group?: string;
}

/** What `cardAnswer` reads from a note. */
export type AnswerNote<N extends Note = Note> = N extends unknown
	? Pick<N, 'id' | 'type' | 'payload'>
	: never;

type AnswerNoteOf<T extends Note['type']> = Extract<AnswerNote, { type: T }>;

/** One card's answer with what distractor ranking needs to know about it. */
export interface AnswerEntry extends CardAnswer {
	cardId: CardId;
	noteId: NoteId;
	topicId: TopicId;
	tags: readonly string[];
}

/** Splits `prefix:a:b` into its numeric parts, or null if the variant has another prefix. */
function indexes(variant: string, prefix: string, count: number): number[] | null {
	const parts = variant.split(':');
	if (parts[0] !== prefix || parts.length !== count + 1) return null;
	const numbers = parts.slice(1).map((part) => (/^\d+$/.test(part) ? Number(part) : -1));
	return numbers.every((n) => n >= 0) ? numbers : null;
}

/** Splits `prefix:<id>` into the ID, or null. */
function idOf(variant: string, prefix: string): string | null {
	return variant.startsWith(`${prefix}:`) ? variant.slice(prefix.length + 1) : null;
}

const term = (text: string, group?: string): CardAnswer =>
	group === undefined ? { text, kind: 'term' } : { text, kind: 'term', group };

/** The term of a note whose only card is `fwd`. */
const fwdOnly = (variant: string, text: string): CardAnswer | null =>
	variant === 'fwd' ? term(text) : null;

function factAnswer({ payload }: AnswerNoteOf<'fact'>, variant: string): CardAnswer | null {
	if (variant === 'fwd') return { text: payload.definition, kind: 'definition' };
	return variant === 'rev' ? term(payload.term) : null;
}

function clozeAnswer({ id, payload }: AnswerNoteOf<'cloze'>, variant: string): CardAnswer | null {
	const match = /^c([1-9]\d*)$/.exec(variant);
	const text = match ? clozeAnswers(payload.text)[Number(match[1]) - 1] : undefined;
	return text === undefined ? null : term(text, `${id}/cloze`);
}

function sequenceAnswer(note: AnswerNoteOf<'sequence'>, variant: string): CardAnswer | null {
	const [i] = indexes(variant, 'step', 1) ?? [];
	const text = i === undefined ? undefined : note.payload.steps[i + 1];
	return text === undefined ? null : { text, kind: 'step', group: `${note.id}/steps` };
}

function compareAnswer(note: AnswerNoteOf<'compare'>, variant: string): CardAnswer | null {
	const [r, c] = indexes(variant, 'cell', 2) ?? [];
	if (r === undefined || c === undefined) return null;
	const text = note.payload.rows[r]?.values[c];
	return text === undefined ? null : term(text, `${note.id}/row:${r}`);
}

function edgeAnswer(note: AnswerNoteOf<'diagram'>, edgeId: string): CardAnswer | null {
	const edge = note.payload.edges.find((candidate) => candidate.id === edgeId);
	if (!edge) return null;
	if (edge.label !== undefined) return term(edge.label, `${note.id}/edges`);
	const target = note.payload.nodes.find((node) => node.id === edge.to);
	return target ? term(target.label, `${note.id}/nodes`) : null;
}

function diagramAnswer(note: AnswerNoteOf<'diagram'>, variant: string): CardAnswer | null {
	const nodePrefix = note.payload.kind === 'stack' ? 'layer' : 'node';
	const nodeId = idOf(variant, nodePrefix);
	if (nodeId !== null) {
		const node = note.payload.nodes.find((candidate) => candidate.id === nodeId);
		return node ? term(node.label, `${note.id}/nodes`) : null;
	}
	const edgeId = note.payload.kind === 'flow' ? idOf(variant, 'edge') : null;
	return edgeId === null ? null : edgeAnswer(note, edgeId);
}

function occlusionAnswer(note: AnswerNoteOf<'occlusion'>, variant: string): CardAnswer | null {
	const boxId = idOf(variant, 'box');
	const box = note.payload.boxes.find((candidate) => candidate.id === boxId);
	return box ? term(box.label, `${note.id}/boxes`) : null;
}

/**
 * The text answer of a note's card, or null for cards answered by order or structure.
 *
 * @see DATA_MODEL §4.2, §4.3
 * @see BUILD_PLAN Decisions log (cardAnswer)
 */
export function cardAnswer(note: AnswerNote, variant: string): CardAnswer | null {
	switch (note.type) {
		case 'keyterm':
			return fwdOnly(variant, note.payload.term);
		case 'fact':
			return factAnswer(note, variant);
		case 'cloze':
			return clozeAnswer(note, variant);
		case 'sequence':
			return sequenceAnswer(note, variant);
		case 'compare':
			return compareAnswer(note, variant);
		case 'scenario':
			return fwdOnly(variant, note.payload.answer);
		case 'example':
			return null;
		case 'diagram':
			return diagramAnswer(note, variant);
		case 'occlusion':
			return occlusionAnswer(note, variant);
		default:
			return assertNever(note);
	}
}

/** The answer entries of a course's cards; cards with no text answer, or no note, are left out. */
export function answerEntries(
	cards: readonly { id: CardId; noteId: NoteId; variant: string }[],
	notes: ReadonlyMap<NoteId, AnswerNote & Pick<Note, 'topicId' | 'tags'>>
): AnswerEntry[] {
	return cards.flatMap((card) => {
		const note = notes.get(card.noteId);
		const answer = note ? cardAnswer(note, card.variant) : null;
		if (!note || !answer) return [];
		return [
			{ ...answer, cardId: card.id, noteId: note.id, topicId: note.topicId, tags: note.tags }
		];
	});
}
