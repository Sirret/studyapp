import { describe, expect, it } from 'vitest';
import { EMPTY_CARD_CACHES, type Card } from '#lib/db/schemas/card.ts';
import type {
	CardId,
	CardStatus,
	CourseId,
	DeviceId,
	NoteId,
	TopicId
} from '#lib/db/schemas/common.ts';
import type { Course, Topic } from '#lib/db/schemas/course.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import type { NoteContent } from '#lib/engine/cardgen.ts';
import { filterCardList, toCardList, type CardListInput } from '#lib/services/card-list.ts';

const META = { createdAt: 1, updatedAt: 1, deviceId: 'device' as DeviceId };
const COURSE = 'course' as CourseId;

const course: Course = {
	...META,
	id: COURSE,
	name: 'Networks',
	status: 'active',
	examFormat: 'mixed',
	color: 'sky'
};

function topic(id: string, name: string, order: number): Topic {
	return {
		...META,
		id: id as TopicId,
		courseId: COURSE,
		name,
		order,
		placement: 'unread',
		priority: 'normal'
	};
}

function note(
	id: string,
	topicId: string,
	order: number,
	content: NoteContent,
	extra: Partial<Pick<Note, 'check' | 'generated' | 'tags'>> = {}
): Note {
	return {
		...META,
		id: id as NoteId,
		courseId: COURSE,
		topicId: topicId as TopicId,
		order,
		priority: 'normal',
		tags: [],
		generated: false,
		check: false,
		accept: {},
		...extra,
		...content
	} as Note;
}

function card(
	id: string,
	noteId: string,
	variant: string,
	status: CardStatus = 'unseen',
	suspended = false
): Card {
	return {
		...META,
		...EMPTY_CARD_CACHES,
		id: id as CardId,
		noteId: noteId as NoteId,
		courseId: COURSE,
		variant,
		path: ['cloze'],
		suspended,
		status
	};
}

function input(): CardListInput {
	return {
		course,
		// Stored out of order: the list follows `order`.
		topics: [topic('t2', 'Transport', 1), topic('t1', 'Café layer', 0), topic('t3', 'Empty', 2)],
		notes: [
			note('n2', 't1', 1, { type: 'keyterm', payload: { term: 'Hub', meaning: 'repeats bits' } }),
			note(
				'n1',
				't1',
				0,
				{ type: 'fact', payload: { term: 'Switch', definition: 'forwards frames' } },
				{ tags: ['layer2'] }
			),
			note(
				'n3',
				't2',
				0,
				{ type: 'cloze', payload: { text: 'The {{SYN}} then {{ACK}}' } },
				{ check: true }
			),
			note(
				'n4',
				't2',
				1,
				{ type: 'sequence', payload: { name: 'Handshake', steps: ['SYN', 'SYN-ACK', 'ACK'] } },
				{ generated: true }
			)
		],
		cards: [
			card('c1', 'n1', 'fwd', 'secure'),
			card('c2', 'n1', 'rev'),
			card('c3', 'n2', 'fwd'),
			card('c4', 'n3', 'c1', 'learning', true),
			card('c5', 'n3', 'c2'),
			card('c6', 'n4', 'seq')
		]
	};
}

/** BUILD_PLAN §10 row 8.5 ("See all cards"). */
describe('toCardList', () => {
	it('lists topics in course order and notes in note order, leaving out empty topics', () => {
		const view = toCardList(input());
		expect(view.courseId).toBe(COURSE);
		expect(view.courseName).toBe('Networks');
		expect(view.topics.map((t) => t.name)).toEqual(['Café layer', 'Transport']);
		expect(view.topics.map((t) => t.rows.map((row) => row.noteId))).toEqual([
			['n1', 'n2'],
			['n3', 'n4']
		]);
	});

	it('shows each note as a question and an answer in plain words', () => {
		const rows = toCardList(input()).topics.flatMap((t) => t.rows);
		expect(rows.map((row) => [row.prompt, row.answer])).toEqual([
			['Switch', 'forwards frames'],
			['Hub', 'repeats bits'],
			['The ___ then ___', 'SYN, ACK'],
			['Handshake', 'SYN → SYN-ACK → ACK']
		]);
	});

	it("carries the note's content, type, flags and tags, and its cards' statuses", () => {
		const [switchRow, hubRow] = toCardList(input()).topics[0]?.rows ?? [];
		const [clozeRow, seqRow] = toCardList(input()).topics[1]?.rows ?? [];
		expect(switchRow?.type).toBe('fact');
		expect(switchRow?.content).toEqual({
			type: 'fact',
			payload: { term: 'Switch', definition: 'forwards frames' }
		});
		expect(switchRow?.tags).toEqual(['layer2']);
		expect(switchRow?.cards).toEqual([
			{ id: 'c1', variant: 'fwd', status: 'secure', suspended: false },
			{ id: 'c2', variant: 'rev', status: 'unseen', suspended: false }
		]);
		expect(hubRow?.flagged).toBe(false);
		expect(clozeRow?.flagged).toBe(true);
		expect(clozeRow?.cards[0]).toMatchObject({ status: 'learning', suspended: true });
		expect(seqRow?.generated).toBe(true);
	});

	it('counts all rows and the flagged ones', () => {
		const view = toCardList(input());
		expect(view.total).toBe(4);
		expect(view.flagged).toBe(1);
	});

	it('gives every note type a non-empty prompt and answer', () => {
		const contents: NoteContent[] = [
			{ type: 'scenario', payload: { situation: 'Packets drop', answer: 'Congestion' } },
			{
				type: 'example',
				payload: {
					name: 'Subnet',
					steps: [
						{ subgoal: 'Find mask', step: '/24' },
						{ subgoal: 'Count hosts', step: '254' }
					]
				}
			},
			{
				type: 'compare',
				payload: { items: ['TCP', 'UDP'], rows: [{ attribute: 'Reliable', values: ['yes', 'no'] }] }
			}
		];
		const view = toCardList({
			...input(),
			notes: contents.map((content, i) => note(`x${i}`, 't1', i, content)),
			cards: []
		});
		for (const row of view.topics[0]?.rows ?? []) {
			expect(row.prompt.length).toBeGreaterThan(0);
			expect(row.answer.length).toBeGreaterThan(0);
		}
	});
});

/** BUILD_PLAN §10 row 8.5 (search and the "Check these" filter). */
describe('filterCardList', () => {
	const view = toCardList(input());
	const ids = (filtered: ReturnType<typeof filterCardList>) =>
		filtered.topics.flatMap((t) => t.rows.map((row) => row.noteId));

	it('returns everything for an empty search and "all"', () => {
		expect(filterCardList(view, '  ', 'all')).toEqual(view);
	});

	it.each([
		['the prompt', 'switch', ['n1']],
		['the answer', 'REPEATS', ['n2']],
		['a tag', 'layer2', ['n1']],
		['the topic name, without accents', 'cafe', ['n1', 'n2']],
		['any word of several', 'hub handshake', ['n2', 'n4']]
	])('matches %s', (_where, query, expected) => {
		expect(ids(filterCardList(view, query, 'all'))).toEqual(expected);
	});

	it('drops topics left with no rows and keeps the course-wide counts', () => {
		const filtered = filterCardList(view, 'switch', 'all');
		expect(filtered.topics.map((t) => t.name)).toEqual(['Café layer']);
		expect(filtered.total).toBe(4);
		expect(filtered.flagged).toBe(1);
	});

	it('"flagged" keeps flagged rows; "paused" keeps rows with a suspended card', () => {
		expect(ids(filterCardList(view, '', 'flagged'))).toEqual(['n3']);
		expect(ids(filterCardList(view, '', 'paused'))).toEqual(['n3']);
		expect(ids(filterCardList(view, 'switch', 'flagged'))).toEqual([]);
	});
});
