import type { Card } from '#lib/db/schemas/card.ts';
import type { Course, Topic } from '#lib/db/schemas/course.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import { CLOZE_SPAN, clozeAnswers, type NoteContent } from '#lib/engine/cardgen.ts';
import { assertNever } from '#lib/util/result.ts';
import type {
	CardListFilter,
	CardListRow,
	CardListTopic,
	CardListView
} from './card-list-types.ts';

/** The records a card list is built from (tombstones already left out). */
export interface CardListInput {
	course: Course;
	topics: readonly Topic[];
	notes: readonly Note[];
	cards: readonly Card[];
}

const BLANK = '___';
const LIST_JOIN = ', ';
const STEP_JOIN = ' → ';
/** Shown when a side would otherwise be empty, so every row reads as a question and an answer. */
const EMPTY_SIDE = '—';

function sides(content: NoteContent): [prompt: string, answer: string] {
	switch (content.type) {
		case 'keyterm':
			return [content.payload.term, content.payload.meaning];
		case 'fact':
			return [content.payload.term, content.payload.definition];
		case 'cloze':
			return [
				content.payload.text.replace(CLOZE_SPAN, BLANK),
				clozeAnswers(content.payload.text).join(LIST_JOIN)
			];
		case 'sequence':
			return [content.payload.name, content.payload.steps.join(STEP_JOIN)];
		case 'example':
			return [content.payload.name, content.payload.steps.map((s) => s.step).join(STEP_JOIN)];
		case 'compare':
			return [
				content.payload.items.join(' vs '),
				content.payload.rows.map((r) => r.attribute).join(LIST_JOIN)
			];
		case 'scenario':
			return [content.payload.situation, content.payload.answer];
		case 'diagram':
			return [content.payload.name, content.payload.nodes.map((n) => n.label).join(LIST_JOIN)];
		case 'occlusion':
			return ['Label the image', content.payload.boxes.map((b) => b.label).join(LIST_JOIN)];
		default:
			return assertNever(content);
	}
}

/** `Map.groupBy` without needing an ES2024 browser. */
function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
	const groups = new Map<K, T[]>();
	for (const item of items) {
		const k = key(item);
		const group = groups.get(k);
		if (group) group.push(item);
		else groups.set(k, [item]);
	}
	return groups;
}

/** Stored cards come back in ID order (random); show them as made, then c1, c2 … c10. */
function byCreation(a: Card, b: Card): number {
	return a.createdAt - b.createdAt || a.variant.localeCompare(b.variant, 'en', { numeric: true });
}

function toRow(note: Note, cards: readonly Card[]): CardListRow {
	const content = { type: note.type, payload: note.payload } as NoteContent;
	const [prompt, answer] = sides(content);
	return {
		noteId: note.id,
		type: note.type,
		content,
		prompt: prompt.trim() || EMPTY_SIDE,
		answer: answer.trim() || EMPTY_SIDE,
		flagged: note.check,
		generated: note.generated,
		tags: [...note.tags],
		cards: [...cards].sort(byCreation).map((c) => ({
			id: c.id,
			variant: c.variant,
			status: c.status,
			suspended: c.suspended
		}))
	};
}

/**
 * Builds the card list: topics in course order, each note as one row in note order, with its
 * question and answer in plain words and its cards' statuses. Topics with no notes are left out.
 *
 * @see BUILD_PLAN §10 row 8.5 ("See all cards")
 */
export function toCardList(input: CardListInput): CardListView {
	const cardsByNote = groupBy(input.cards, (card) => card.noteId);
	const notesByTopic = groupBy(input.notes, (note) => note.topicId);
	const topics: CardListTopic[] = [...input.topics]
		.sort((a, b) => a.order - b.order)
		.map((topic) => ({
			id: topic.id,
			name: topic.name,
			rows: [...(notesByTopic.get(topic.id) ?? [])]
				.sort((a, b) => a.order - b.order)
				.map((note) => toRow(note, cardsByNote.get(note.id) ?? []))
		}))
		.filter((topic) => topic.rows.length > 0);
	const rows = topics.flatMap((topic) => topic.rows);
	return {
		courseId: input.course.id,
		courseName: input.course.name,
		topics,
		total: rows.length,
		flagged: rows.filter((row) => row.flagged).length
	};
}

/** Lower case with accents removed, so "Café" matches "cafe". */
function fold(text: string): string {
	return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function passesFilter(row: CardListRow, filter: CardListFilter): boolean {
	switch (filter) {
		case 'all':
			return true;
		case 'flagged':
			return row.flagged;
		case 'paused':
			return row.cards.some((card) => card.suspended);
		default:
			return assertNever(filter);
	}
}

/**
 * Narrows the list to rows matching the search text (any word of the prompt, answer, tags or
 * topic name; case- and accent-insensitive) and the filter. Topics left with no rows are dropped;
 * `total` and `flagged` keep counting the whole course.
 *
 * @see BUILD_PLAN §10 row 8.5
 */
export function filterCardList(
	view: CardListView,
	query: string,
	filter: CardListFilter
): CardListView {
	const words = fold(query).split(/\s+/).filter(Boolean);
	const matches = (row: CardListRow, topicName: string): boolean => {
		if (words.length === 0) return true;
		const haystack = fold([row.prompt, row.answer, ...row.tags, topicName].join(' '));
		return words.some((word) => haystack.includes(word));
	};
	const topics = view.topics
		.map((topic) => ({
			...topic,
			rows: topic.rows.filter((row) => passesFilter(row, filter) && matches(row, topic.name))
		}))
		.filter((topic) => topic.rows.length > 0);
	return { ...view, topics };
}
