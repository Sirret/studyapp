import { describe, expect, it } from 'vitest';
import type { MediaId } from '#lib/db/schemas/common.ts';
import type { NoteContent } from '#lib/engine/cardgen.ts';
import { dropDuplicateNotes, noteFingerprint, sectionFingerprint } from '#lib/import/duplicates.ts';
import type { PlannedChunk, PlannedContent, PlannedNote, PlannedTopic } from '#lib/import/build.ts';

const MEDIA = '11111111-1111-4111-8111-111111111111' as MediaId;
const NODE = '22222222-2222-4222-8222-222222222222';

/** A note that is neither an occlusion: fits both NoteContent and PlannedContent. */
type Plain = Exclude<NoteContent, { type: 'occlusion' }>;

const keyterm = (term: string, meaning: string): Plain => ({
	type: 'keyterm',
	payload: { term, meaning }
});
const fact = (term: string, definition: string): Plain => ({
	type: 'fact',
	payload: { term, definition }
});
const stackDiagram = (): Plain => ({
	type: 'diagram',
	payload: { kind: 'stack', name: 'OSI', nodes: [{ id: NODE, label: 'L1' }], edges: [] }
});

const note = (line: number, content: PlannedContent): PlannedNote => ({
	line,
	content,
	priority: 'normal',
	tags: [],
	isGenerated: false,
	isChecked: false,
	cards: []
});

const chunk = (line: number, title: string, text: string): PlannedChunk =>
	({ line, title, text, words: [] }) as unknown as PlannedChunk;

const topic = (name: string, notes: PlannedNote[], chunks: PlannedChunk[] = []): PlannedTopic => ({
	name,
	priority: 'normal',
	from: [],
	chunks,
	notes
});

/** @see BUILD_PLAN §10 row 8.5 and the Decisions log "duplicate notes are skipped course-wide" */
describe('noteFingerprint', () => {
	it('is equal for the same note in a different case', () => {
		expect(noteFingerprint(keyterm('TCP', 'Transmission Control Protocol'))).toBe(
			noteFingerprint(keyterm('tcp', 'transmission control protocol'))
		);
	});

	it('is equal when inner spacing differs', () => {
		expect(noteFingerprint(keyterm('a  b', 'x   y\tz'))).toBe(
			noteFingerprint(keyterm('a b', 'x y z'))
		);
	});

	it('is equal when punctuation at the ends or surrounding spaces differ', () => {
		expect(noteFingerprint(fact('Latency', ' Delay before a transfer. '))).toBe(
			noteFingerprint(fact('Latency?', 'Delay before a transfer'))
		);
	});

	it('differs for a different note type with the same text', () => {
		expect(noteFingerprint(keyterm('a', 'b'))).not.toBe(noteFingerprint(fact('a', 'b')));
	});

	it('differs for a different payload', () => {
		expect(noteFingerprint(keyterm('a', 'b'))).not.toBe(noteFingerprint(keyterm('a', 'c')));
		expect(noteFingerprint(keyterm('a', 'b'))).not.toBe(noteFingerprint(keyterm('c', 'b')));
	});

	it('does not confuse where one field ends and the next begins', () => {
		expect(noteFingerprint(keyterm('ab', 'c'))).not.toBe(noteFingerprint(keyterm('a', 'bc')));
	});

	it('fingerprints cloze, sequence, compare, scenario and example notes as distinct strings', () => {
		const notes: Plain[] = [
			{ type: 'cloze', payload: { text: 'The {{CPU}} runs code' } },
			{ type: 'sequence', payload: { name: 'Boot', steps: ['BIOS', 'Loader'] } },
			{
				type: 'compare',
				payload: { items: ['A', 'B'], rows: [{ attribute: 'x', values: ['1', '2'] }] }
			},
			{ type: 'scenario', payload: { situation: 's', answer: 'a' } },
			{
				type: 'example',
				payload: {
					name: 'n',
					steps: [
						{ subgoal: 'g1', step: 's1' },
						{ subgoal: 'g2', step: 's2' }
					]
				}
			}
		];
		const prints = notes.map((n) => noteFingerprint(n));
		for (const p of prints) expect(typeof p).toBe('string');
		expect(new Set(prints).size).toBe(notes.length);
	});

	it('differs for sequences with the same steps in a different order', () => {
		const seq = (steps: string[]): Plain => ({
			type: 'sequence',
			payload: { name: 'n', steps }
		});
		expect(noteFingerprint(seq(['a', 'b']))).not.toBe(noteFingerprint(seq(['b', 'a'])));
	});

	it('is null for an occlusion note whose image is not identified (stored shape)', () => {
		expect(
			noteFingerprint({ type: 'occlusion', payload: { mediaId: MEDIA, boxes: [] } })
		).toBeNull();
	});

	it('is null for a planned occlusion note whose file is not identified', () => {
		expect(noteFingerprint({ type: 'occlusion', file: 'a.png' })).toBeNull();
	});

	/** Decisions log "Phase 6 Q10–Q13": an image already in the course is found by source hash. */
	it('is equal for a planned and a stored occlusion note on the same image', () => {
		const images = { ofFile: () => MEDIA, ofMedia: (id: string) => id };
		const stored = noteFingerprint(
			{ type: 'occlusion', payload: { mediaId: MEDIA, boxes: [] } },
			images
		);
		expect(stored).not.toBeNull();
		expect(noteFingerprint({ type: 'occlusion', file: 'a.png' }, images)).toBe(stored);
	});

	it('is equal for diagrams with the same structure and different IDs, case or source', () => {
		const other: Plain = {
			type: 'diagram',
			payload: {
				kind: 'stack',
				name: 'osi model',
				nodes: [{ id: '33333333-3333-4333-8333-333333333333', label: 'l1 ' }],
				edges: [],
				sourceMediaId: MEDIA
			}
		};
		expect(noteFingerprint(stackDiagram())).toBe(noteFingerprint(other));
	});

	it('is equal for flows with the same arrows in another order, and differs on a label', () => {
		const [a, b, c] = [
			NODE,
			'44444444-4444-4444-8444-444444444444',
			'55555555-5555-4555-8555-555555555555'
		];
		const flow = (edges: { from: string; to: string; label?: string }[]): Plain => ({
			type: 'diagram',
			payload: {
				kind: 'flow',
				name: 'F',
				nodes: [
					{ id: a, label: 'A' },
					{ id: b, label: 'B' },
					{ id: c, label: 'C' }
				],
				edges: edges.map((edge, i) => ({ id: `6666666${i}-6666-4666-8666-666666666666`, ...edge }))
			}
		});
		const ab = { from: a, to: b, label: 'x' };
		const bc = { from: b, to: c };
		expect(noteFingerprint(flow([ab, bc]))).toBe(noteFingerprint(flow([bc, ab])));
		expect(noteFingerprint(flow([ab, bc]))).not.toBe(
			noteFingerprint(flow([{ ...ab, label: 'y' }, bc]))
		);
	});

	it('gives the same fingerprint for NoteContent and PlannedContent of the same note', () => {
		const content: NoteContent = keyterm('a', 'b');
		const planned: PlannedContent = keyterm('a', 'b');
		expect(noteFingerprint(content)).toBe(noteFingerprint(planned));
	});
});

describe('sectionFingerprint', () => {
	it('is equal for the same title and text once normalised', () => {
		expect(sectionFingerprint({ title: 'Memory', text: 'The  heap grows.' })).toBe(
			sectionFingerprint({ title: ' memory ', text: 'the heap grows' })
		);
	});

	it('differs for a different title', () => {
		expect(sectionFingerprint({ title: 'A', text: 'same' })).not.toBe(
			sectionFingerprint({ title: 'B', text: 'same' })
		);
	});

	it('differs for a different text', () => {
		expect(sectionFingerprint({ title: 'same', text: 'one' })).not.toBe(
			sectionFingerprint({ title: 'same', text: 'two' })
		);
	});

	it('does not confuse where the title ends and the text begins', () => {
		expect(sectionFingerprint({ title: 'ab', text: 'c' })).not.toBe(
			sectionFingerprint({ title: 'a', text: 'bc' })
		);
	});
});

describe('dropDuplicateNotes', () => {
	it('drops a planned note that the course already has', () => {
		const { result } = dropDuplicateNotes(
			[topic('T', [note(3, keyterm('A', 'b')), note(4, keyterm('C', 'd'))])],
			[keyterm('a', 'B.')]
		);
		expect(result.topics[0]?.notes.map((n) => n.line)).toEqual([4]);
		expect(result.skipped).toEqual([{ line: 3, topic: 'T' }]);
	});

	it('matches existing notes of any topic (course-wide)', () => {
		const { result } = dropDuplicateNotes(
			[topic('Other topic', [note(1, fact('x', 'y'))])],
			[keyterm('unrelated', 'z'), fact('X', 'Y')]
		);
		expect(result.topics[0]?.notes).toEqual([]);
		expect(result.skipped).toEqual([{ line: 1, topic: 'Other topic' }]);
	});

	it('drops a later duplicate inside the paste and keeps the first', () => {
		const { result } = dropDuplicateNotes(
			[
				topic('T', [
					note(1, keyterm('a', 'b')),
					note(2, keyterm('c', 'd')),
					note(3, keyterm('A', 'b'))
				])
			],
			[]
		);
		expect(result.topics[0]?.notes.map((n) => n.line)).toEqual([1, 2]);
		expect(result.skipped).toEqual([{ line: 3, topic: 'T' }]);
	});

	it('drops a duplicate that appears in a later topic of the same paste', () => {
		const { result } = dropDuplicateNotes(
			[topic('First', [note(1, keyterm('a', 'b'))]), topic('Second', [note(9, keyterm('a', 'b'))])],
			[]
		);
		expect(result.topics[0]?.notes.map((n) => n.line)).toEqual([1]);
		expect(result.topics[1]?.notes).toEqual([]);
		expect(result.skipped).toEqual([{ line: 9, topic: 'Second' }]);
	});

	it('keeps occlusion notes whose image is not identified', () => {
		const occ = (line: number): PlannedNote => note(line, { type: 'occlusion', file: 'a.png' });
		const { result } = dropDuplicateNotes(
			[topic('T', [occ(1), occ(2)])],
			[{ type: 'occlusion', payload: { mediaId: MEDIA, boxes: [] } }]
		);
		expect(result.topics[0]?.notes).toHaveLength(2);
		expect(result.skipped).toEqual([]);
	});

	/** Decisions log "Phase 6 Q10–Q13" */
	it('drops an occlusion note on an image the course already has, and a repeat in the paste', () => {
		const images = {
			ofFile: (file: string) => (file === 'a.png' ? MEDIA : 'new:other'),
			ofMedia: (id: string) => id
		};
		const occ = (line: number, file: string): PlannedNote =>
			note(line, { type: 'occlusion', file });
		const { result } = dropDuplicateNotes(
			[topic('T', [occ(1, 'a.png'), occ(2, 'b.png'), occ(3, 'b.png')])],
			[{ type: 'occlusion', payload: { mediaId: MEDIA, boxes: [] } }],
			images
		);
		expect(result.topics[0]?.notes.map((n) => n.line)).toEqual([2]);
		expect(result.skipped).toEqual([
			{ line: 1, topic: 'T' },
			{ line: 3, topic: 'T' }
		]);
	});

	/** Decisions log "Phase 6 Q10–Q13" ("changed diagram: kept both") */
	it('drops an identical diagram and keeps a changed one with the same name, listing it', () => {
		const changed: Plain = {
			type: 'diagram',
			payload: { kind: 'stack', name: 'OSI', nodes: [{ id: NODE, label: 'L2' }], edges: [] }
		};
		const { result } = dropDuplicateNotes(
			[topic('T', [note(1, stackDiagram()), note(2, changed)])],
			[stackDiagram()]
		);
		expect(result.topics[0]?.notes.map((n) => n.line)).toEqual([2]);
		expect(result.skipped).toEqual([{ line: 1, topic: 'T' }]);
		expect(result.changed).toEqual([{ line: 2, topic: 'T', name: 'OSI' }]);
	});

	it('keeps the order of the notes that stay, and the topics and sections unchanged', () => {
		const sectionsA = [chunk(1, 'S1', 'text one'), chunk(5, 'S2', 'text two')];
		const sectionsB = [chunk(7, 'S3', 'text three')];
		const topics = [
			topic(
				'A',
				[note(2, keyterm('k1', 'v')), note(3, keyterm('dup', 'v')), note(4, keyterm('k2', 'v'))],
				sectionsA
			),
			topic('B', [note(8, keyterm('dup', 'v'))], sectionsB),
			topic('C', [])
		];
		const { result } = dropDuplicateNotes(topics, []);
		expect(result.topics.map((t) => t.name)).toEqual(['A', 'B', 'C']);
		expect(result.topics[0]?.notes.map((n) => n.line)).toEqual([2, 3, 4]);
		expect(result.topics[1]?.notes).toEqual([]);
		expect(result.topics[0]?.chunks).toEqual(sectionsA);
		expect(result.topics[1]?.chunks).toEqual(sectionsB);
	});

	it('preserves the order of kept notes when some in between are dropped', () => {
		const { result } = dropDuplicateNotes(
			[
				topic('T', [
					note(1, keyterm('a', '1')),
					note(2, keyterm('b', '2')),
					note(3, keyterm('c', '3')),
					note(4, keyterm('d', '4'))
				])
			],
			[keyterm('b', '2'), keyterm('c', '3')]
		);
		expect(result.topics[0]?.notes.map((n) => n.line)).toEqual([1, 4]);
	});

	it('keeps a topic and its sections even when all its notes are dropped', () => {
		const { result } = dropDuplicateNotes(
			[topic('Empty now', [note(1, keyterm('a', 'b'))], [chunk(0, 'S', 't')])],
			[keyterm('a', 'b')]
		);
		expect(result.topics).toHaveLength(1);
		expect(result.topics[0]?.name).toBe('Empty now');
		expect(result.topics[0]?.chunks).toHaveLength(1);
		expect(result.topics[0]?.notes).toEqual([]);
	});

	it('reports skipped duplicates in plan order with their line and topic name', () => {
		const { result } = dropDuplicateNotes(
			[
				topic('One', [note(10, keyterm('a', 'b')), note(11, keyterm('c', 'd'))]),
				topic('Two', [note(20, keyterm('e', 'f'))])
			],
			[keyterm('a', 'b'), keyterm('e', 'f')]
		);
		expect(result.skipped).toEqual([
			{ line: 10, topic: 'One' },
			{ line: 20, topic: 'Two' }
		]);
	});

	it('returns everything unchanged and skips nothing when there are no duplicates', () => {
		const topics = [topic('T', [note(1, keyterm('a', 'b')), note(2, fact('c', 'd'))])];
		const { result } = dropDuplicateNotes(topics, [keyterm('zzz', 'yyy')]);
		expect(result.topics).toEqual(topics);
		expect(result.skipped).toEqual([]);
	});

	it('handles empty topics and empty existing', () => {
		expect(dropDuplicateNotes([], []).result).toEqual({ topics: [], skipped: [], changed: [] });
	});

	it('does not treat notes of different types with the same text as duplicates', () => {
		const { result } = dropDuplicateNotes(
			[topic('T', [note(1, fact('a', 'b'))])],
			[keyterm('a', 'b')]
		);
		expect(result.topics[0]?.notes).toHaveLength(1);
		expect(result.skipped).toEqual([]);
	});

	it('does not mutate its inputs', () => {
		const topics = [topic('T', [note(1, keyterm('a', 'b')), note(2, keyterm('a', 'b'))])];
		const copy = structuredClone(topics);
		dropDuplicateNotes(topics, []);
		expect(topics).toEqual(copy);
	});

	it('returns a trace', () => {
		const { trace } = dropDuplicateNotes(
			[topic('T', [note(1, keyterm('a', 'b'))])],
			[keyterm('a', 'b')]
		);
		expect(trace.length).toBeGreaterThan(0);
		expect(trace.every((entry) => typeof entry.rule === 'string')).toBe(true);
	});

	it('is deterministic', () => {
		const topics = [topic('T', [note(1, keyterm('a', 'b')), note(2, keyterm('a', 'b'))])];
		expect(dropDuplicateNotes(topics, [])).toEqual(dropDuplicateNotes(topics, []));
	});
});
