import { describe, expect, it } from 'vitest';
import type { MediaId, NoteId } from '#lib/db/schemas/common.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import { MC_OPTIONS } from '#lib/config/defaults.ts';
import { answerEntries, cardAnswer, type AnswerNote } from '#lib/engine/answers.ts';
import { pickDistractors } from '#lib/engine/distractors.ts';
import { generateCards, type NoteContent } from '#lib/engine/cardgen.ts';
import { choiceInput } from './answer-fixtures.ts';
import { cardId, makeNote, noteId, topicId, uuid } from './fixtures.ts';

const ID = noteId(7);
/** Test notes are written `as const`, so their arrays are readonly; the shape is still a note's. */
const answerOf = (content: object, variant: string) =>
	cardAnswer({ id: ID, ...content } as AnswerNote, variant);

const A = uuid(0xa1);
const B = uuid(0xb1);
const C = uuid(0xc1);
const E1 = uuid(0xe1);
const E2 = uuid(0xe2);

const flow = {
	type: 'diagram',
	payload: {
		kind: 'flow',
		name: 'f',
		nodes: [
			{ id: A, label: 'Client' },
			{ id: B, label: 'Server' }
		],
		edges: [
			{ id: E1, from: A, to: B, label: 'SYN' },
			{ id: E2, from: B, to: A }
		]
	}
} as const;

/** @see BUILD_PLAN Decisions log (cardAnswer) and DATA_MODEL §4.3 */
describe('cardAnswer', () => {
	it('asks a keyterm card for the term', () => {
		expect(answerOf({ type: 'keyterm', payload: { term: 'TCP', meaning: 'm' } }, 'fwd')).toEqual({
			text: 'TCP',
			kind: 'term'
		});
	});

	it('asks a fact forward card for the definition and the reverse card for the term', () => {
		const fact = { type: 'fact', payload: { term: 'TCP', definition: 'a protocol' } } as const;
		expect(answerOf(fact, 'fwd')).toEqual({ text: 'a protocol', kind: 'definition' });
		expect(answerOf(fact, 'rev')).toEqual({ text: 'TCP', kind: 'term' });
	});

	it('asks a cloze card for its numbered span, trimmed, grouped with its note', () => {
		const cloze = { type: 'cloze', payload: { text: '{{ IP }} routes, {{TCP}} orders' } } as const;
		expect(answerOf(cloze, 'c1')).toEqual({ text: 'IP', kind: 'term', group: `${ID}/cloze` });
		expect(answerOf(cloze, 'c2')?.text).toBe('TCP');
		expect(answerOf(cloze, 'c3')).toBeNull();
		expect(answerOf(cloze, 'c0')).toBeNull();
	});

	it('asks a step card for the step after it; the whole-order card has no text', () => {
		const seq = { type: 'sequence', payload: { name: 's', steps: ['a', 'b', 'c'] } } as const;
		expect(answerOf(seq, 'step:0')).toEqual({ text: 'b', kind: 'step', group: `${ID}/steps` });
		expect(answerOf(seq, 'step:1')?.text).toBe('c');
		expect(answerOf(seq, 'step:2')).toBeNull();
		expect(answerOf(seq, 'seq')).toBeNull();
	});

	it('asks a cell card for its value, grouped with the same attribute', () => {
		const table = {
			type: 'compare',
			payload: {
				items: ['TCP', 'UDP'],
				rows: [
					{ attribute: 'reliable', values: ['yes', 'no'] },
					{ attribute: 'header', values: ['20 B', '8 B'] }
				]
			}
		} as const;
		expect(answerOf(table, 'cell:1:0')).toEqual({
			text: '20 B',
			kind: 'cell',
			group: `${ID}/row:1`
		});
		expect(answerOf(table, 'cell:2:0')).toBeNull();
		expect(answerOf(table, 'cell:x:0')).toBeNull();
		expect(answerOf(table, 'row:0')).toBeNull();
		expect(answerOf(table, 'which:0')).toBeNull();
	});

	it('asks a scenario card for its answer', () => {
		const scenario = { type: 'scenario', payload: { situation: 'video', answer: 'UDP' } } as const;
		expect(answerOf(scenario, 'fwd')).toEqual({ text: 'UDP', kind: 'term' });
	});

	it('gives a worked example no text answer', () => {
		const example = {
			type: 'example',
			payload: {
				name: 'e',
				steps: [
					{ subgoal: 'a', step: 'b' },
					{ subgoal: 'c', step: 'd' }
				]
			}
		} as const;
		expect(answerOf(example, 'ex')).toBeNull();
	});

	it('asks a stack layer card for the label; the whole-stack card has no text', () => {
		const stack = {
			type: 'diagram',
			payload: { kind: 'stack', name: 'OSI', nodes: [{ id: C, label: 'Transport' }], edges: [] }
		} as const;
		expect(answerOf(stack, `layer:${C}`)).toEqual({
			text: 'Transport',
			kind: 'term',
			group: `${ID}/nodes`
		});
		expect(answerOf(stack, 'layers')).toBeNull();
		expect(answerOf(stack, `node:${C}`)).toBeNull();
	});

	it('asks flow cards for node and edge labels; an unlabelled edge asks for its target', () => {
		expect(answerOf(flow, `node:${A}`)?.text).toBe('Client');
		expect(answerOf(flow, `edge:${E1}`)).toEqual({
			text: 'SYN',
			kind: 'term',
			group: `${ID}/edges`
		});
		expect(answerOf(flow, `edge:${E2}`)).toEqual({
			text: 'Client',
			kind: 'term',
			group: `${ID}/nodes`
		});
		expect(answerOf(flow, 'rebuild')).toBeNull();
		expect(answerOf(flow, `layer:${A}`)).toBeNull();
		expect(answerOf(flow, `edge:${C}`)).toBeNull();
	});

	it('asks an occlusion card for its box label', () => {
		const occlusion = {
			type: 'occlusion',
			payload: {
				mediaId: uuid(9) as MediaId,
				boxes: [{ id: C, x: 0, y: 0, w: 1, h: 1, label: 'ALU' }]
			}
		} as const;
		expect(answerOf(occlusion, `box:${C}`)).toEqual({
			text: 'ALU',
			kind: 'term',
			group: `${ID}/boxes`
		});
		expect(answerOf(occlusion, `box:${A}`)).toBeNull();
	});

	it('returns null for a variant the note type does not have', () => {
		expect(answerOf({ type: 'keyterm', payload: { term: 't', meaning: 'm' } }, 'rev')).toBeNull();
		expect(
			answerOf({ type: 'scenario', payload: { situation: 's', answer: 'a' } }, 'rev')
		).toBeNull();
		expect(answerOf({ type: 'fact', payload: { term: 't', definition: 'd' } }, 'c1')).toBeNull();
	});

	it('gives every generated text card of a flow diagram an answer', () => {
		const withText = generateCards(flow as unknown as NoteContent).result.filter(
			(card) => card.variant !== 'rebuild'
		);
		for (const card of withText) expect(answerOf(flow, card.variant)).not.toBeNull();
	});
});

describe('answerEntries', () => {
	it('joins cards with their notes and skips cards with no text answer or no note', () => {
		const keyterm = makeNote({ id: noteId(1) });
		const fact = {
			...makeNote({ id: noteId(2) }),
			tags: ['net'],
			topicId: topicId(3),
			type: 'fact' as const,
			payload: { term: 'TCP', definition: 'reliable' }
		};
		const notes = new Map([
			[keyterm.id, keyterm],
			[fact.id, fact]
		]);
		const entries = answerEntries(
			[
				{ id: cardId(1), noteId: keyterm.id, variant: 'fwd' },
				{ id: cardId(2), noteId: fact.id, variant: 'rev' },
				{ id: cardId(3), noteId: fact.id, variant: 'nope' },
				{ id: cardId(4), noteId: noteId(99), variant: 'fwd' }
			],
			notes
		);
		expect(entries).toEqual([
			{
				text: 't',
				kind: 'term',
				cardId: cardId(1),
				noteId: noteId(1),
				topicId: topicId(1),
				tags: []
			},
			{
				text: 'TCP',
				kind: 'term',
				cardId: cardId(2),
				noteId: noteId(2),
				topicId: topicId(3),
				tags: ['net']
			}
		]);
	});
});

/**
 * A comparison-table value is a property, not a term: its kind is `cell`, so a term question never
 * offers it and a cell question draws only other cell values.
 *
 * @see BUILD_PLAN Decisions log ("Each answer has a kind…", Fix pass) and §6.11
 */
describe('answerEntries: cell answers are their own kind for distractors', () => {
	const TAGS = ['transport'];
	const term = (n: number, text: string): Note => ({
		...makeNote({ id: noteId(n) }),
		tags: TAGS,
		type: 'keyterm',
		payload: { term: text, meaning: `${text} meaning` }
	});
	const table: Note = {
		...makeNote({ id: noteId(4) }),
		tags: TAGS,
		type: 'compare',
		payload: {
			items: ['TCP', 'UDP'],
			rows: [
				{ attribute: 'reliable', values: ['yes', 'no'] },
				{ attribute: 'header', values: ['20 B', '8 B'] }
			]
		}
	};
	const notes = new Map<NoteId, Note>(
		[term(1, 'TCP'), term(2, 'UDP'), term(3, 'ICMP'), table].map((n) => [n.id, n])
	);
	const cells = [
		{ id: cardId(10), variant: 'cell:0:0' },
		{ id: cardId(11), variant: 'cell:0:1' },
		{ id: cardId(12), variant: 'cell:1:0' },
		{ id: cardId(13), variant: 'cell:1:1' }
	];
	// Same topic and same tags for every note, so only the kind can keep the cells apart.
	const entries = answerEntries(
		[
			{ id: cardId(1), noteId: noteId(1), variant: 'fwd' },
			{ id: cardId(2), noteId: noteId(2), variant: 'fwd' },
			{ id: cardId(3), noteId: noteId(3), variant: 'fwd' },
			...cells.map((c) => ({ ...c, noteId: noteId(4) }))
		],
		notes
	);
	const entryOf = (n: number) => entries.find((e) => e.cardId === cardId(n))!;
	const texts = (n: number) =>
		pickDistractors(choiceInput(entryOf(n), entries))
			.result.options.map((o) => o.text)
			.sort();

	it('gives every compare cell entry kind cell', () => {
		expect(
			entries.filter((e) => cells.some((c) => c.id === e.cardId)).map((e) => e.kind)
		).toStrictEqual(['cell', 'cell', 'cell', 'cell']);
	});

	it('never offers a cell value for a term question, even with too few terms to fill MC_OPTIONS', () => {
		expect(texts(1)).toStrictEqual(['ICMP', 'TCP', 'UDP']);
	});

	it('draws only other cell values for a cell question', () => {
		const options = texts(12);
		expect(options).toHaveLength(MC_OPTIONS);
		expect(options).toStrictEqual(['20 B', '8 B', 'no', 'yes'].sort());
	});
});
