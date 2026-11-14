import type { Card } from '#lib/db/schemas/card.ts';
import type { Course, Topic } from '#lib/db/schemas/course.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import type { CardListFilter, CardListView } from './card-list-types.ts';

/** The records a card list is built from (tombstones already left out). */
export interface CardListInput {
	course: Course;
	topics: readonly Topic[];
	notes: readonly Note[];
	cards: readonly Card[];
}

/**
 * Builds the card list: topics in course order, each note as one row in note order, with its
 * question and answer in plain words and its cards' statuses. Topics with no notes are left out.
 *
 * @see BUILD_PLAN §10 row 8.5 ("See all cards")
 */
export function toCardList(_input: CardListInput): CardListView {
	throw new Error('not implemented');
}

/**
 * Narrows the list to rows matching the search text (any word of the prompt, answer, tags or
 * topic name; case- and accent-insensitive) and the filter. Topics left with no rows are dropped;
 * `total` and `flagged` keep counting the whole course.
 *
 * @see BUILD_PLAN §10 row 8.5
 */
export function filterCardList(
	_view: CardListView,
	_query: string,
	_filter: CardListFilter
): CardListView {
	throw new Error('not implemented');
}
