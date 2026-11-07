import type { CardId, NoteId, TopicId } from '#lib/db/schemas/common.ts';
import type { Note } from '#lib/db/schemas/note.ts';

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

/** One card's answer with what distractor ranking needs to know about it. */
export interface AnswerEntry extends CardAnswer {
	cardId: CardId;
	noteId: NoteId;
	topicId: TopicId;
	tags: readonly string[];
}

/**
 * The text answer of a note's card, or null for cards answered by order or structure.
 *
 * @see DATA_MODEL §4.2, §4.3
 * @see BUILD_PLAN Decisions log (cardAnswer)
 */
export function cardAnswer(_note: AnswerNote, _variant: string): CardAnswer | null {
	throw new Error('not implemented');
}

/** The answer entries of a course's cards; cards with no text answer, or no note, are left out. */
export function answerEntries(
	_cards: readonly { id: CardId; noteId: NoteId; variant: string }[],
	_notes: ReadonlyMap<NoteId, AnswerNote & Pick<Note, 'topicId' | 'tags'>>
): AnswerEntry[] {
	throw new Error('not implemented');
}
