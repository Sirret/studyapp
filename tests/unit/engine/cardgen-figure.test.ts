import { describe, expect, it } from 'vitest';
import type { ExerciseKind } from '#lib/db/schemas/common.ts';
import { generateCards, type NoteContent } from '#lib/engine/cardgen.ts';
import { buildCourse, build, type NoteDef } from './exercise-fixtures.ts';
import { mediaId, uuid } from './fixtures.ts';

const boxes = (labels: readonly string[]) =>
	labels.map((label, i) => ({
		id: uuid(0x100 + i),
		x: i * 0.1,
		y: 0.1,
		w: 0.08,
		h: 0.08,
		label
	}));

const occlusion = (
	labels: readonly string[],
	extra: { unplaced?: string[] } = {}
): NoteContent => ({
	type: 'occlusion',
	payload: { mediaId: mediaId(1), boxes: boxes(labels), ...extra }
});

const cardsOf = (content: NoteContent) => generateCards(content).result;

const FIGURE_PATH: ExerciseKind[] = ['occlusionBank', 'occlusionDrag', 'occlusionType'];

describe('occlusion cards (DATA_MODEL §4.3, Decisions "Phase 6 Q3")', () => {
	it('gives every labelled box a card on the path occlusionBank → occlusionDrag → occlusionType', () => {
		expect(cardsOf(occlusion(['Zebra', 'Yak', 'Walrus']))).toEqual(
			[0, 1, 2].map((i) => ({ variant: `box:${uuid(0x100 + i)}`, path: FIGURE_PATH }))
		);
	});

	it('still makes the same path for an image with a single box (drag falls back at build time)', () => {
		expect(cardsOf(occlusion(['Zebra']))).toEqual([
			{ variant: `box:${uuid(0x100)}`, path: FIGURE_PATH }
		]);
	});

	it('makes no card before boxes exist, and none for unplaced labels', () => {
		expect(cardsOf(occlusion([]))).toEqual([]);
		expect(cardsOf(occlusion([], { unplaced: ['Zebra', 'Yak'] }))).toEqual([]);
	});

	it('makes no card for a box with an empty label until it is named', () => {
		const cards = cardsOf(occlusion(['Zebra', '', '   ', 'Yak']));
		expect(cards.map((c) => c.variant)).toEqual([`box:${uuid(0x100)}`, `box:${uuid(0x103)}`]);
	});

	it('keeps variants stable: adding a box adds a card and changes no other variant', () => {
		const before = cardsOf(occlusion(['Zebra', 'Yak'])).map((c) => c.variant);
		const after = cardsOf(occlusion(['Zebra', 'Yak', 'Walrus'])).map((c) => c.variant);
		expect(after.slice(0, 2)).toEqual(before);
		expect(after).toHaveLength(3);
	});
});

describe('diagram cards keep their variants and paths', () => {
	const nodes = ['A', 'B', 'C'].map((label, i) => ({ id: uuid(0x200 + i), label }));

	it('stack: layers (layerOrder) and layer:<id> (nodeCloze)', () => {
		const cards = cardsOf({
			type: 'diagram',
			payload: { kind: 'stack', name: 'S', nodes, edges: [] }
		});
		expect(cards[0]).toEqual({ variant: 'layers', path: ['layerOrder'] });
		expect(cards.slice(1)).toEqual(
			nodes.map((n) => ({ variant: `layer:${n.id}`, path: ['nodeCloze'] }))
		);
	});

	it('flow: node (nodeCloze), edge (edgeCloze) and rebuild (structureRebuild)', () => {
		const edges = [{ id: uuid(0x300), from: nodes[0]?.id ?? '', to: nodes[1]?.id ?? '' }];
		const cards = cardsOf({ type: 'diagram', payload: { kind: 'flow', name: 'F', nodes, edges } });
		expect(cards).toEqual([
			...nodes.map((n) => ({ variant: `node:${n.id}`, path: ['nodeCloze'] })),
			{ variant: `edge:${uuid(0x300)}`, path: ['edgeCloze'] },
			{ variant: 'rebuild', path: ['structureRebuild'] }
		]);
	});
});

// ---------------------------------------------------------------------------------------------
// Through buildExercise: the six figure kinds no longer use diagramFallback; hotspot and redraw do.
// ---------------------------------------------------------------------------------------------

describe('buildExercise: the figure kinds are built, hotspot and redraw still fall back', () => {
	const flowNodes = ['Client', 'Server', 'Database'].map((label, i) => ({
		id: uuid(0x400 + i),
		label
	}));
	const defs: NoteDef[] = [
		{ content: occlusion(['Zebra', 'Yak', 'Walrus']) },
		{
			content: {
				type: 'diagram',
				payload: {
					kind: 'stack',
					name: 'OSI',
					nodes: ['Application', 'Transport', 'Network'].map((label, i) => ({
						id: uuid(0x500 + i),
						label
					})),
					edges: []
				}
			}
		},
		{
			content: {
				type: 'diagram',
				payload: {
					kind: 'flow',
					name: 'Handshake',
					nodes: flowNodes,
					edges: [
						{
							id: uuid(0x600),
							from: flowNodes[0]?.id ?? '',
							to: flowNodes[1]?.id ?? '',
							label: 'req'
						},
						{ id: uuid(0x601), from: flowNodes[1]?.id ?? '', to: flowNodes[2]?.id ?? '' }
					]
				}
			}
		}
	];
	const course = buildCourse(defs);
	const box = `box:${uuid(0x100)}`;
	const layer = `layer:${uuid(0x500)}`;
	const node = `node:${uuid(0x400)}`;
	const edge = `edge:${uuid(0x600)}`;

	const CASES: readonly [ExerciseKind, number, string][] = [
		['occlusionBank', 1, box],
		['occlusionDrag', 1, box],
		['occlusionType', 1, box],
		['nodeCloze', 2, layer],
		['nodeCloze', 3, node],
		['edgeCloze', 3, edge],
		['structureRebuild', 3, 'rebuild'],
		['layerOrder', 2, 'layers']
	];

	it.each(CASES)(
		'%s on note %i %s is built as itself, with no fallback in the trace',
		(kind, n, variant) => {
			const { result, trace } = build(course, n, variant, kind);
			expect(result.kind).toBe(kind);
			expect(trace.filter((entry) => entry.rule === 'exercise.fallback')).toEqual([]);
		}
	);

	it.each([
		['hotspot', 1, box],
		['redraw', 2, 'layers']
	] as const)('%s still falls back (to flip)', (kind, n, variant) => {
		const { result, trace } = build(course, n, variant, kind);
		expect(trace[0]).toMatchObject({ rule: 'exercise.fallback', from: kind, to: 'flip' });
		expect(result.kind).toBe('flip');
	});

	it('a single-box image: the whole path falls back to typing (bank, then drag)', () => {
		const one = buildCourse([{ content: occlusion(['Zebra']) }]);
		for (const kind of ['occlusionBank', 'occlusionDrag'] as const) {
			const { result, trace } = build(one, 1, box, kind);
			expect(result.kind).toBe('occlusionType');
			expect(trace[0]).toMatchObject({
				rule: 'exercise.fallback',
				from: kind,
				to: 'occlusionType'
			});
		}
	});

	it('a two-box image: the bank is built with two options and the drag with both boxes', () => {
		const two = buildCourse([{ content: occlusion(['Zebra', 'Yak']) }]);
		const bank = build(two, 1, box, 'occlusionBank').result;
		expect(bank.kind).toBe('occlusionBank');
		expect(bank.shape === 'choose' && bank.options).toHaveLength(2);
		expect(build(two, 1, box, 'occlusionDrag').result.kind).toBe('occlusionDrag');
	});
});
