import type { CardId, CardStatus, CourseId, NoteId, TopicId } from '#lib/db/schemas/common.ts';
import type { NoteType } from '#lib/db/schemas/note.ts';
import type { NoteContent } from '#lib/engine/cardgen.ts';

/** One card of a note, as the card list shows it. */
export interface CardListCard {
	id: CardId;
	variant: string;
	status: CardStatus;
	/** Excluded from study (paused by "This card looks wrong", or suspended). */
	suspended: boolean;
}

/** One row of the card list: a note, the question and answer it shows, and its cards. */
export interface CardListRow {
	noteId: NoteId;
	type: NoteType;
	/** The note's content, for the editor. */
	content: NoteContent;
	/** The question side in plain words (term, cloze text with blanks, sequence name…). */
	prompt: string;
	/** The answer side in plain words. */
	answer: string;
	/** Flagged: unsure from the import, or "This card looks wrong" (DATA_MODEL §3.4 `check`). */
	flagged: boolean;
	/** Came from an `[ADDED]` part of the reply. */
	generated: boolean;
	/** The note's tags (`@tag`), searched too. */
	tags: string[];
	cards: CardListCard[];
}

/** A topic and its rows, in course order then note order. */
export interface CardListTopic {
	id: TopicId;
	name: string;
	rows: CardListRow[];
}

/** Everything the "See all cards" screen shows for a course. */
export interface CardListView {
	courseId: CourseId;
	courseName: string;
	topics: CardListTopic[];
	/** Rows over all topics. */
	total: number;
	/** Flagged rows over all topics (the "Check these" filter). */
	flagged: number;
}

/** Which rows the list shows. */
export type CardListFilter = 'all' | 'flagged' | 'paused';
