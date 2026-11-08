import { describe, expect, it } from 'vitest';
import type { CardId } from '#lib/db/schemas/common.ts';
import type { NoteContent } from '#lib/engine/cardgen.ts';
import { checkResponse } from '#lib/engine/exercise-check.ts';
import { flipAnswer, promptFor, titleOf } from '#lib/engine/exercise-prompts.ts';
import type { ExerciseSpec } from '#lib/engine/exercise-spec.ts';
import { createRng } from '#lib/engine/rng.ts';
import {
	asShape,
	build,
	buildCourse,
	cloze,
	compare,
	example,
	fact,
	keyterm,
	noteOf,
	scenario,
	sequence
} from './exercise-fixtures.ts';

/**
 * Fallback paths and helper cases of BUILD_PLAN §5.1 that the spec tests don't reach: a kind asked
 * for a card it can't be built for, diagram and occlusion notes (Phase 6 kinds fall back), and the
 * prompt, title and flip helpers for every note type.
 */

const stack: NoteContent = {
	type: 'diagram',
	payload: {
		kind: 'stack',
		name: 'OSI',
		nodes: [
			{ id: 'n1', label: 'Application' },
			{ id: 'n2', label: 'Transport' }
		],
		edges: []
	}
} as NoteContent;
const occlusion: NoteContent = {
	type: 'occlusion',
	payload: { mediaId: 'm1', boxes: [{ id: 'b1', x: 0, y: 0, w: 0.5, h: 0.5, label: 'CPU' }] }
} as NoteContent;

const COURSE = buildCourse([
	{ content: keyterm('TCP', 'reliable byte stream') },
	{ content: fact('UDP', 'connectionless datagrams') },
	{ content: cloze('The {{CPU}} runs {{instructions}}.') },
	{ content: sequence('Handshake', ['SYN', 'SYN-ACK', 'ACK']) },
	{
		content: example('Solve', [
			['find', 'step one'],
			['check', 'step two']
		])
	},
	{ content: compare(['TCP', 'UDP'], [['setup', ['handshake', 'none']]]) },
	{ content: scenario('Live video', 'UDP') },
	{ content: stack },
	{ content: occlusion }
]);

describe('fallbacks when a kind does not fit the card (BUILD_PLAN §5.1)', () => {
	it.each([
		['sequence', 1, 'fwd', 'flip'],
		['parsons', 1, 'fwd', 'flip'],
		['subgoalMatch', 1, 'fwd', 'flip'],
		['exampleStudy', 1, 'fwd', 'flip'],
		['fadeStep', 2, 'fwd', 'cloze'],
		['newInstance', 2, 'fwd', 'cloze'],
		['oddOneOut', 1, 'fwd', 'mc'],
		['multiSelect', 1, 'fwd', 'mc'],
		['pickPrinciple', 1, 'fwd', 'mc'],
		['tableRow', 1, 'fwd', 'mc'],
		['categorize', 1, 'fwd', 'mc'],
		['matching', 3, 'c1', 'mc'],
		['explainIt', 1, 'fwd', 'flip'],
		['whichOne', 1, 'fwd', 'mc'],
		['scenario', 1, 'fwd', 'mc']
	] as const)('%s on note %i %s falls back towards %s', (kind, n, variant, first) => {
		const { result, trace } = build(COURSE, n, variant, kind);
		expect(trace[0]).toMatchObject({ rule: 'exercise.fallback', from: kind, to: first });
		expect(result.kind).not.toBe(kind);
	});

	it.each([
		['occlusionBank', 9, 'box:b1'],
		['occlusionType', 9, 'box:b1'],
		['nodeCloze', 8, 'layer:n1'],
		['layerOrder', 8, 'layers'],
		['hotspot', 9, 'box:b1'],
		['redraw', 8, 'layers']
	] as const)('diagram kind %s falls back until Phase 6', (kind, n, variant) => {
		const { trace } = build(COURSE, n, variant, kind);
		expect(trace[0]).toMatchObject({ rule: 'exercise.fallback', from: kind });
	});

	it('flip always builds, even for a card with no text answer', () => {
		const spec = asShape(build(COURSE, 8, 'layers', 'flip').result, 'selfRate');
		expect(spec.kind).toBe('flip');
	});

	it('blurt on a note whose cards have no text answers falls back to flip', () => {
		expect(build(COURSE, 5, 'ex', 'blurt').result.kind).toBe('flip');
	});
});

describe('prompts, titles and flip answers for every note type', () => {
	const rng = () => createRng(3);

	it('diagram and occlusion prompts name the diagram or box', () => {
		expect(promptFor(noteOf(COURSE, 8), 'layers', rng()).text).toBe('OSI');
		expect(promptFor(noteOf(COURSE, 9), 'box:b1', rng()).text).toBe('CPU');
		expect(promptFor(noteOf(COURSE, 9), 'box:missing', rng()).text).toBe('');
	});

	it('titles come from the term, name, situation, text, items or boxes', () => {
		expect(titleOf(noteOf(COURSE, 1))).toBe('TCP');
		expect(titleOf(noteOf(COURSE, 3))).toBe('The CPU runs instructions.');
		expect(titleOf(noteOf(COURSE, 6))).toBe('TCP vs UDP');
		expect(titleOf(noteOf(COURSE, 7))).toBe('Live video');
		expect(titleOf(noteOf(COURSE, 8))).toBe('OSI');
		expect(titleOf(noteOf(COURSE, 9))).toBe('CPU');
	});

	it('flip answers: steps for sequences, nothing for a which card', () => {
		expect(flipAnswer(noteOf(COURSE, 4), 'seq')).toBe('SYN\nSYN-ACK\nACK');
		expect(flipAnswer(noteOf(COURSE, 6), 'which:0')).toBeNull();
		expect(flipAnswer(noteOf(COURSE, 8), 'layers')).toBeNull();
	});
});

describe('checkResponse edge cases', () => {
	const own = 'c-own' as CardId;
	const choose: ExerciseSpec = {
		shape: 'choose',
		kind: 'mc',
		cardId: own,
		prompt: 'p',
		instruction: 'i',
		options: [{ text: 'A' }, { text: 'B', cardId: 'c-b' as CardId }],
		correctIndex: 0,
		letter: null
	};

	it('a pick from another card without its prompt gives the card but no contrast', () => {
		const verdict = checkResponse(choose, { shape: 'choose', index: 1 }).result;
		expect(verdict.chosenFromCardId).toBe('c-b');
		expect(verdict.contrast).toBeUndefined();
	});

	it('an out-of-range pick is wrong and names nothing', () => {
		const verdict = checkResponse(choose, { shape: 'choose', index: 9 }).result;
		expect(verdict.correct).toBe(false);
		expect(verdict.chosen).toBeUndefined();
	});

	it('an order with an unknown item is wrong without throwing', () => {
		const order: ExerciseSpec = {
			shape: 'order',
			kind: 'sequence',
			cardId: own,
			prompt: 'p',
			instruction: 'i',
			items: ['a', 'b'],
			correctOrder: [0, 1],
			extras: []
		};
		expect(checkResponse(order, { shape: 'order', order: [0, 7] }).result.correct).toBe(false);
	});

	it('a typed collision without a known prompt names the card but has no contrast', () => {
		const typed: ExerciseSpec = {
			shape: 'type',
			kind: 'cloze',
			cardId: own,
			prompt: 'p',
			instruction: 'i',
			answer: 'TCP',
			accepted: [],
			others: [{ cardId: 'c-u' as CardId, text: 'UDP' }],
			letter: null,
			context: []
		};
		const verdict = checkResponse(typed, { shape: 'type', typed: 'UDP' }).result;
		expect(verdict.chosenFromCardId).toBe('c-u');
		expect(verdict.contrast).toBeUndefined();
	});
});
