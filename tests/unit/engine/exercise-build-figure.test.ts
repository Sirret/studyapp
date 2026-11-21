import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DIAGRAM_MAX_NODES, MC_OPTIONS, OCCLUSION_BANK_MIN_OPTIONS } from '#lib/config/defaults.ts';
import type { NoteContent } from '#lib/engine/cardgen.ts';
import { layoutDiagram } from '#lib/engine/diagram-layout.ts';
import {
	buildEdgeCloze,
	buildLayerOrder,
	buildNodeCloze,
	buildOcclusionBank,
	buildOcclusionDrag,
	buildOcclusionType,
	buildStructureRebuild
} from '#lib/engine/exercise-build-figure.ts';
import { checkResponse } from '#lib/engine/exercise-check.ts';
import { makeContext, type Built } from '#lib/engine/exercise-context.ts';
import type { ExerciseShape, ExerciseSpec, Figure } from '#lib/engine/exercise-spec.ts';
import { normalizeAnswer } from '#lib/engine/grading.ts';
import {
	asShape,
	build,
	buildCourse,
	cardIdOf,
	cardOf,
	inputFor,
	type BuildOptions,
	type NoteDef,
	type TestCourse
} from './exercise-fixtures.ts';
import { cardId, mediaId, noteId, NUM_RUNS, uuid } from './fixtures.ts';

// ---------------------------------------------------------------------------------------------
// Fixtures. Notes are written by hand; cards come from the real generateCards (variants only).
// ---------------------------------------------------------------------------------------------

const boxId = (base: number, i: number): string => uuid(0x1000 + base * 0x100 + i);

interface OcclusionOptions {
	hide?: 'one' | 'all';
	title?: string;
	base?: number;
	media?: number;
}

function occlusion(labels: readonly string[], options: OcclusionOptions = {}): NoteContent {
	const base = options.base ?? 0;
	return {
		type: 'occlusion',
		payload: {
			mediaId: mediaId(options.media ?? 7),
			boxes: labels.map((label, i) => ({
				id: boxId(base, i),
				x: (i % 5) * 0.2,
				y: Math.floor(i / 5) * 0.2,
				w: 0.15,
				h: 0.1,
				label
			})),
			...(options.hide ? { hide: options.hide } : {}),
			...(options.title ? { title: options.title } : {})
		}
	};
}

interface DiagramFixture {
	content: NoteContent;
	nodes: { id: string; label: string }[];
	edges: { id: string; from: string; to: string; label?: string }[];
	nodeId: (label: string) => string;
	edgeId: (i: number) => string;
}

function flow(
	arrows: readonly (readonly [string, string, string?])[],
	extra: { sourceMediaId?: number; name?: string } = {}
): DiagramFixture {
	const labels: string[] = [];
	for (const [from, to] of arrows) {
		for (const label of [from, to]) if (!labels.includes(label)) labels.push(label);
	}
	const nodes = labels.map((label, i) => ({ id: uuid(0x2000 + i), label }));
	const nodeId = (label: string): string => {
		const found = nodes.find((node) => node.label === label);
		if (!found) throw new Error(`fixture: no node ${label}`);
		return found.id;
	};
	const edges = arrows.map(([from, to, label], i) => ({
		id: uuid(0x3000 + i),
		from: nodeId(from),
		to: nodeId(to),
		...(label ? { label } : {})
	}));
	const content = {
		type: 'diagram',
		payload: {
			kind: 'flow',
			name: extra.name ?? 'Handshake',
			nodes,
			edges,
			...(extra.sourceMediaId ? { sourceMediaId: mediaId(extra.sourceMediaId) } : {})
		}
	} as NoteContent;
	return { content, nodes, edges, nodeId, edgeId: (i) => uuid(0x3000 + i) };
}

function stack(labels: readonly string[], extra: { sourceMediaId?: number } = {}): DiagramFixture {
	const nodes = labels.map((label, i) => ({ id: uuid(0x2000 + i), label }));
	const content = {
		type: 'diagram',
		payload: {
			kind: 'stack',
			name: 'OSI',
			nodes,
			edges: [],
			...(extra.sourceMediaId ? { sourceMediaId: mediaId(extra.sourceMediaId) } : {})
		}
	} as NoteContent;
	return {
		content,
		nodes,
		edges: [],
		nodeId: (label) => {
			const found = nodes.find((node) => node.label === label);
			if (!found) throw new Error(`fixture: no node ${label}`);
			return found.id;
		},
		edgeId: (i) => uuid(0x3000 + i)
	};
}

/** The course's card for `variant`, or a hand-made one when generateCards makes none for it. */
function cardFor(course: TestCourse, n: number, variant: string) {
	const found = course.cards.find((c) => c.noteId === noteId(n) && c.variant === variant);
	return found ?? { id: cardId(9000 + n), noteId: noteId(n), variant, path: [] };
}

function ctxOf(
	course: TestCourse,
	n: number,
	variant: string,
	kind: Parameters<typeof inputFor>[2],
	options: BuildOptions = {}
) {
	const card = cardFor(course, n, variant);
	const cards = course.cards.includes(card) ? course.cards : [...course.cards, card];
	return makeContext(inputFor(course, card, kind, { ...options, cards }));
}

function shapeOf<S extends ExerciseShape>(built: Built, shape: S) {
	if ('fallback' in built)
		throw new Error(`expected a ${shape} spec, got fallback ${built.fallback}`);
	return asShape(built, shape);
}

const occlusionFigure = (figure: Figure | undefined) => {
	if (figure?.kind !== 'occlusion') throw new Error('expected an occlusion figure');
	return figure;
};
const diagramFigure = (figure: Figure | undefined) => {
	if (figure?.kind !== 'diagram') throw new Error('expected a diagram figure');
	return figure;
};

const IMAGE = ['Zebra', 'Yak', 'Walrus', 'Vole', 'Urial', 'Tapir'];
const A = (i: number): string => boxId(0, i);
const BOX_NOTE = (labels: readonly string[], options: OcclusionOptions = {}): NoteDef[] => [
	{ content: occlusion(labels, options) },
	{ content: occlusion(['Quokka', 'Pangolin', 'Okapi', 'Numbat'], { base: 1, media: 8 }) },
	{ content: { type: 'keyterm', payload: { term: 'Ibex', meaning: 'a wild goat' } } }
];

// ---------------------------------------------------------------------------------------------
// occlusionBank
// ---------------------------------------------------------------------------------------------

describe('buildOcclusionBank (BUILD_PLAN §7.1, Decisions "Phase 6 Q3")', () => {
	const course = buildCourse(BOX_NOTE(IMAGE));
	const bank = (i: number, options: BuildOptions = {}) =>
		shapeOf(
			buildOcclusionBank(ctxOf(course, 1, `box:${A(i)}`, 'occlusionBank', options)),
			'choose'
		);

	it('builds a choose spec of kind occlusionBank whose correct option is the asked label', () => {
		const spec = bank(2);
		expect(spec.kind).toBe('occlusionBank');
		expect(spec.cardId).toBe(cardIdOf(1, 2));
		expect(spec.options[spec.correctIndex]?.text).toBe('Walrus');
	});

	it('takes every option from the same image only, never from other notes', () => {
		const spec = bank(0);
		for (const option of spec.options) expect(IMAGE).toContain(option.text);
		expect(spec.options.map((o) => o.text)).not.toContain('Ibex');
		expect(spec.options.map((o) => o.text)).not.toContain('Quokka');
	});

	it('shows at most MC_OPTIONS distinct options when the image has more boxes', () => {
		const spec = bank(0);
		expect(IMAGE.length).toBeGreaterThan(MC_OPTIONS);
		expect(spec.options).toHaveLength(MC_OPTIONS);
		const texts = spec.options.map((o) => normalizeAnswer(o.text));
		expect(new Set(texts).size).toBe(texts.length);
	});

	it('gives a small image fewer options (3 boxes: 3 options)', () => {
		const small = buildCourse(BOX_NOTE(['Zebra', 'Yak', 'Walrus']));
		const spec = shapeOf(
			buildOcclusionBank(ctxOf(small, 1, `box:${A(1)}`, 'occlusionBank')),
			'choose'
		);
		expect(spec.options.map((o) => o.text).sort()).toEqual(['Walrus', 'Yak', 'Zebra']);
	});

	it('still builds with exactly OCCLUSION_BANK_MIN_OPTIONS options', () => {
		const labels = IMAGE.slice(0, OCCLUSION_BANK_MIN_OPTIONS);
		const two = buildCourse(BOX_NOTE(labels));
		const spec = shapeOf(
			buildOcclusionBank(ctxOf(two, 1, `box:${A(0)}`, 'occlusionBank')),
			'choose'
		);
		expect(spec.options).toHaveLength(OCCLUSION_BANK_MIN_OPTIONS);
	});

	it('falls back to occlusionType below OCCLUSION_BANK_MIN_OPTIONS (one box)', () => {
		const one = buildCourse(BOX_NOTE(IMAGE.slice(0, OCCLUSION_BANK_MIN_OPTIONS - 1)));
		const built = buildOcclusionBank(ctxOf(one, 1, `box:${A(0)}`, 'occlusionBank'));
		expect(built).toMatchObject({ fallback: 'occlusionType' });
	});

	it('counts options after normalising: "Router" and "router" are one option', () => {
		const dup = buildCourse(BOX_NOTE(['Router', 'router']));
		expect(buildOcclusionBank(ctxOf(dup, 1, `box:${A(0)}`, 'occlusionBank'))).toMatchObject({
			fallback: 'occlusionType'
		});
	});

	it('leaves empty-labelled boxes out of the options', () => {
		const withEmpty = buildCourse(BOX_NOTE(['Zebra', 'Yak', '', 'Walrus']));
		const spec = shapeOf(
			buildOcclusionBank(ctxOf(withEmpty, 1, `box:${A(0)}`, 'occlusionBank')),
			'choose'
		);
		expect(spec.options.map((o) => o.text).sort()).toEqual(['Walrus', 'Yak', 'Zebra']);
	});

	it('falls back to flip when the box of the variant is gone', () => {
		const built = buildOcclusionBank(ctxOf(course, 1, `box:${uuid(0xdead)}`, 'occlusionBank'));
		expect(built).toMatchObject({ fallback: 'flip' });
	});

	it('falls back to flip when the asked box has an empty label', () => {
		const empty = buildCourse(BOX_NOTE(['Zebra', 'Yak', '']));
		const built = buildOcclusionBank(ctxOf(empty, 1, `box:${A(2)}`, 'occlusionBank'));
		expect(built).toMatchObject({ fallback: 'flip' });
	});

	it('covers only the asked box in hide-one mode (hide absent or "one") and targets it', () => {
		for (const hide of [undefined, 'one'] as const) {
			const c = buildCourse(BOX_NOTE(IMAGE, hide ? { hide } : {}));
			const spec = shapeOf(
				buildOcclusionBank(ctxOf(c, 1, `box:${A(3)}`, 'occlusionBank')),
				'choose'
			);
			const figure = occlusionFigure(spec.figure);
			expect(figure.covered).toEqual([A(3)]);
			expect(figure.target).toBe(A(3));
		}
	});

	it('covers every box in hide-all mode and still targets the asked box', () => {
		const c = buildCourse(BOX_NOTE(IMAGE, { hide: 'all' }));
		const spec = shapeOf(buildOcclusionBank(ctxOf(c, 1, `box:${A(3)}`, 'occlusionBank')), 'choose');
		const figure = occlusionFigure(spec.figure);
		expect([...figure.covered].sort()).toEqual(IMAGE.map((_l, i) => A(i)).sort());
		expect(figure.target).toBe(A(3));
	});

	it('draws the image: media id, title (payload title, else "Image"), boxes in payload order without labels', () => {
		const titled = buildCourse(BOX_NOTE(IMAGE, { title: 'Savannah' }));
		const figure = occlusionFigure(bank(0).figure);
		expect(figure.mediaId).toBe(mediaId(7));
		expect(figure.title).toBe('Image');
		expect(figure.boxes.map((b) => b.id)).toEqual(IMAGE.map((_l, i) => A(i)));
		for (const box of figure.boxes)
			expect(Object.keys(box).sort()).toEqual(['h', 'id', 'w', 'x', 'y']);
		const named = shapeOf(
			buildOcclusionBank(ctxOf(titled, 1, `box:${A(0)}`, 'occlusionBank')),
			'choose'
		);
		expect(occlusionFigure(named.figure).title).toBe('Savannah');
	});

	it('leaves empty-labelled boxes out of the figure', () => {
		const withEmpty = buildCourse(BOX_NOTE(['Zebra', '', 'Yak']));
		const spec = shapeOf(
			buildOcclusionBank(ctxOf(withEmpty, 1, `box:${A(0)}`, 'occlusionBank')),
			'choose'
		);
		expect(occlusionFigure(spec.figure).boxes.map((b) => b.id)).toEqual([A(0), A(2)]);
	});

	it('never puts a label in the figure', () => {
		const json = JSON.stringify(bank(0).figure);
		for (const label of IMAGE) expect(json).not.toContain(label);
	});

	it('shuffles the options with the seed: same seed, same spec; the right answer moves between seeds', () => {
		expect(bank(1, { attempt: 4 })).toEqual(bank(1, { attempt: 4 }));
		const positions = new Set(
			Array.from({ length: 40 }, (_x, a) => bank(1, { attempt: a }).correctIndex)
		);
		expect(positions.size).toBeGreaterThan(1);
	});

	it('for every seed holds the answer once and only the image’s labels', () => {
		fc.assert(
			fc.property(fc.nat(10_000), fc.integer({ min: 0, max: IMAGE.length - 1 }), (attempt, i) => {
				const spec = bank(i, { attempt });
				const texts = spec.options.map((o) => o.text);
				expect(texts.filter((t) => t === IMAGE[i])).toHaveLength(1);
				expect(spec.options[spec.correctIndex]?.text).toBe(IMAGE[i]);
				for (const text of texts) expect(IMAGE).toContain(text);
			}),
			{ numRuns: NUM_RUNS }
		);
	});

	it('is graded like a choice: the right index is correct, another is a plain wrong', () => {
		const spec = bank(0);
		const right = checkResponse(spec, { shape: 'choose', index: spec.correctIndex }).result;
		expect(right.correct).toBe(true);
		const wrongIndex = (spec.correctIndex + 1) % spec.options.length;
		const wrong = checkResponse(spec, { shape: 'choose', index: wrongIndex }).result;
		expect(wrong.correct).toBe(false);
		expect(wrong.reveal).toEqual(['Zebra']);
	});
});

// ---------------------------------------------------------------------------------------------
// occlusionDrag
// ---------------------------------------------------------------------------------------------

describe('buildOcclusionDrag (BUILD_PLAN §7.1, Decisions "Phase 6 Q3")', () => {
	const course = buildCourse(BOX_NOTE(IMAGE));
	const drag = (i: number, c: TestCourse = course) =>
		shapeOf(buildOcclusionDrag(ctxOf(c, 1, `box:${A(i)}`, 'occlusionDrag')), 'place');

	it('builds a place spec with the asked label and box id', () => {
		const spec = drag(2);
		expect(spec.kind).toBe('occlusionDrag');
		expect(spec.label).toBe('Walrus');
		expect(spec.boxId).toBe(A(2));
	});

	it('covers every box and highlights none, even in hide-one mode', () => {
		for (const hide of [undefined, 'one', 'all'] as const) {
			const c = buildCourse(BOX_NOTE(IMAGE, hide ? { hide } : {}));
			const { figure } = drag(2, c);
			expect([...figure.covered].sort()).toEqual(IMAGE.map((_l, i) => A(i)).sort());
			expect(figure.target).toBeNull();
		}
	});

	it('draws the image without any label', () => {
		const json = JSON.stringify(drag(0).figure);
		for (const label of IMAGE) expect(json).not.toContain(label);
		expect(drag(0).figure.mediaId).toBe(mediaId(7));
	});

	it('falls back to occlusionType when the image has only one labelled box', () => {
		const one = buildCourse(BOX_NOTE(['Zebra']));
		expect(buildOcclusionDrag(ctxOf(one, 1, `box:${A(0)}`, 'occlusionDrag'))).toMatchObject({
			fallback: 'occlusionType'
		});
		const oneNamed = buildCourse(BOX_NOTE(['Zebra', '', '']));
		expect(buildOcclusionDrag(ctxOf(oneNamed, 1, `box:${A(0)}`, 'occlusionDrag'))).toMatchObject({
			fallback: 'occlusionType'
		});
	});

	it('builds with two labelled boxes (something to choose between)', () => {
		const two = buildCourse(BOX_NOTE(['Zebra', 'Yak']));
		expect(drag(0, two).boxId).toBe(A(0));
	});

	it('through buildExercise a single-box image shows occlusionType and traces the fallback', () => {
		const one = buildCourse(BOX_NOTE(['Zebra']));
		const { result, trace } = build(one, 1, `box:${A(0)}`, 'occlusionDrag');
		expect(result.kind).toBe('occlusionType');
		expect(result.shape).toBe('type');
		expect(trace[0]).toMatchObject({
			rule: 'exercise.fallback',
			from: 'occlusionDrag',
			to: 'occlusionType'
		});
	});

	it('falls back to flip when the box is gone', () => {
		expect(
			buildOcclusionDrag(ctxOf(course, 1, `box:${uuid(0xdead)}`, 'occlusionDrag'))
		).toMatchObject({
			fallback: 'flip'
		});
	});

	it('is deterministic for the same card, session and attempt', () => {
		const first = build(course, 1, `box:${A(1)}`, 'occlusionDrag', { attempt: 2 });
		expect(first.result.kind).toBe('occlusionDrag');
		const again = build(course, 1, `box:${A(1)}`, 'occlusionDrag', { attempt: 2 });
		expect(again).toEqual(first);
	});
});

// ---------------------------------------------------------------------------------------------
// occlusionType
// ---------------------------------------------------------------------------------------------

describe('buildOcclusionType (BUILD_PLAN §7.1, §6.10)', () => {
	const course = buildCourse(BOX_NOTE(IMAGE));
	const typed = (i: number, c: TestCourse = course, n = 1) =>
		shapeOf(buildOcclusionType(ctxOf(c, n, `box:${boxId(n - 1, i)}`, 'occlusionType')), 'type');

	it('builds a type spec for the asked label with the bank’s figure', () => {
		const spec = typed(3);
		expect(spec.kind).toBe('occlusionType');
		expect(spec.answer).toBe('Vole');
		const figure = occlusionFigure(spec.figure);
		expect(figure.covered).toEqual([A(3)]);
		expect(figure.target).toBe(A(3));
		expect(figure.title).toBe('Image');
	});

	it('covers every box in hide-all mode', () => {
		const c = buildCourse(BOX_NOTE(IMAGE, { hide: 'all' }));
		const figure = occlusionFigure(typed(3, c).figure);
		expect(figure.covered).toHaveLength(IMAGE.length);
		expect(figure.target).toBe(A(3));
	});

	it('uses the note’s accept list for the variant', () => {
		const c = buildCourse(
			BOX_NOTE(IMAGE).map((def, i) =>
				i === 0 ? { ...def, accept: { [`box:${A(0)}`]: ['Plains zebra'] } } : def
			)
		);
		expect(typed(0, c).accepted).toEqual(['Plains zebra']);
		expect(
			checkResponse(typed(0, c), { shape: 'type', typed: 'plains zebra' }).result.correct
		).toBe(true);
	});

	it('does not put the card’s own answer among the collision-guard answers', () => {
		const spec = typed(0);
		expect(spec.others.every((other) => other.cardId !== spec.cardId)).toBe(true);
	});

	it('guards a collision among sibling labels of the same image', () => {
		const c = buildCourse(BOX_NOTE(['TCP', 'UDP', 'Router']));
		const spec = typed(0, c);
		const verdict = checkResponse(spec, { shape: 'type', typed: 'udp' }).result;
		expect(verdict.correct).toBe(false);
		expect(verdict.chosenFromCardId).toBe(cardIdOf(1, 1));
	});

	it('grades short labels exactly (≤ 4 chars: "IP" does not accept "IS" or "I")', () => {
		const c = buildCourse(BOX_NOTE(['IP', 'Router', 'Switch']));
		const spec = typed(0, c);
		expect(checkResponse(spec, { shape: 'type', typed: 'ip' }).result.correct).toBe(true);
		expect(checkResponse(spec, { shape: 'type', typed: 'IS' }).result.correct).toBe(false);
		expect(checkResponse(spec, { shape: 'type', typed: 'I' }).result.correct).toBe(false);
	});

	it('accepts a one-letter typo in a medium label and reports the spelling it matched', () => {
		const c = buildCourse(BOX_NOTE(['Router', 'Switch', 'Hub']));
		const verdict = checkResponse(typed(0, c), { shape: 'type', typed: 'Rooter' }).result;
		expect(verdict.correct).toBe(true);
		expect(verdict.typo).toBe('Router');
	});

	it('builds for an image with a single box (the target of the drag fallback)', () => {
		const one = buildCourse(BOX_NOTE(['Zebra']));
		expect(typed(0, one).answer).toBe('Zebra');
	});

	it('falls back to flip when the box is gone or unlabelled', () => {
		expect(
			buildOcclusionType(ctxOf(course, 1, `box:${uuid(0xdead)}`, 'occlusionType'))
		).toMatchObject({
			fallback: 'flip'
		});
		const empty = buildCourse(BOX_NOTE(['Zebra', 'Yak', '']));
		expect(buildOcclusionType(ctxOf(empty, 1, `box:${A(2)}`, 'occlusionType'))).toMatchObject({
			fallback: 'flip'
		});
	});

	it('is deterministic and leaks no label into the figure', () => {
		expect(typed(1)).toEqual(typed(1));
		const json = JSON.stringify(typed(1).figure);
		for (const label of IMAGE) expect(json).not.toContain(label);
	});
});

// ---------------------------------------------------------------------------------------------
// nodeCloze
// ---------------------------------------------------------------------------------------------

describe('buildNodeCloze (BUILD_PLAN §7.2)', () => {
	const f = flow(
		[
			['Client', 'Server', 'request'],
			['Server', 'Database', 'query']
		],
		{ sourceMediaId: 5 }
	);
	const course = buildCourse([{ content: f.content }]);

	const node = (label: string, c: TestCourse = course) =>
		shapeOf(buildNodeCloze(ctxOf(c, 1, `node:${f.nodeId(label)}`, 'nodeCloze')), 'type');

	it('asks for the node label with that label hidden and the node targeted', () => {
		const spec = node('Server');
		expect(spec.kind).toBe('nodeCloze');
		expect(spec.answer).toBe('Server');
		const figure = diagramFigure(spec.figure);
		expect(figure.shape).toBe('flow');
		expect(figure.target).toBe(f.nodeId('Server'));
		expect(figure.nodes.find((n) => n.id === f.nodeId('Server'))?.label).toBeNull();
		expect(figure.nodes.find((n) => n.id === f.nodeId('Client'))?.label).toBe('Client');
		expect(figure.nodes.find((n) => n.id === f.nodeId('Database'))?.label).toBe('Database');
	});

	it('keeps the whole diagram: every node and every arrow with its label', () => {
		const figure = diagramFigure(node('Client').figure);
		expect(figure.nodes.map((n) => n.id)).toEqual(f.nodes.map((n) => n.id));
		expect(figure.edges.map((e) => [e.id, e.from, e.to, e.label])).toEqual(
			f.edges.map((e) => [e.id, e.from, e.to, e.label])
		);
	});

	it('draws with the layout of layoutDiagram and the source picture of the payload', () => {
		const figure = diagramFigure(node('Client').figure);
		const expected = layoutDiagram({ kind: 'flow', nodes: f.nodes, edges: f.edges }).result;
		expect(figure.layout).toEqual(expected);
		expect(figure.sourceMediaId).toBe(mediaId(5));
		expect(figure.title).toBe('Handshake');
	});

	it('has no sourceMediaId when the payload has none', () => {
		const plain = flow([['A', 'B']]);
		const c = buildCourse([{ content: plain.content }]);
		const spec = shapeOf(
			buildNodeCloze(ctxOf(c, 1, `node:${plain.nodeId('A')}`, 'nodeCloze')),
			'type'
		);
		expect(diagramFigure(spec.figure).sourceMediaId).toBeUndefined();
	});

	it('gives layout null when the diagram is too big to draw, and still builds', () => {
		const arrows = Array.from(
			{ length: DIAGRAM_MAX_NODES },
			(_x, i) => [`N${i}`, `N${i + 1}`] as const
		);
		const big = flow(arrows);
		expect(big.nodes.length).toBeGreaterThan(DIAGRAM_MAX_NODES);
		const c = buildCourse([{ content: big.content }]);
		const spec = shapeOf(
			buildNodeCloze(ctxOf(c, 1, `node:${big.nodeId('N3')}`, 'nodeCloze')),
			'type'
		);
		expect(diagramFigure(spec.figure).layout).toBeNull();
	});

	it('works for a stack layer (`layer:<id>`), drawn as a stack', () => {
		const s = stack(['Application', 'Transport', 'Network']);
		const c = buildCourse([{ content: s.content }]);
		const spec = shapeOf(
			buildNodeCloze(ctxOf(c, 1, `layer:${s.nodeId('Transport')}`, 'nodeCloze')),
			'type'
		);
		expect(spec.answer).toBe('Transport');
		const figure = diagramFigure(spec.figure);
		expect(figure.shape).toBe('stack');
		expect(figure.target).toBe(s.nodeId('Transport'));
		expect(figure.nodes.map((n) => n.label)).toEqual(['Application', null, 'Network']);
	});

	it('falls back to flip when the node is gone', () => {
		expect(buildNodeCloze(ctxOf(course, 1, `node:${uuid(0xdead)}`, 'nodeCloze'))).toMatchObject({
			fallback: 'flip'
		});
	});

	it('checks typed answers with the node label (short labels exact)', () => {
		const ip = flow([
			['IP', 'TCP'],
			['TCP', 'App']
		]);
		const c = buildCourse([{ content: ip.content }]);
		const spec = shapeOf(
			buildNodeCloze(ctxOf(c, 1, `node:${ip.nodeId('IP')}`, 'nodeCloze')),
			'type'
		);
		expect(checkResponse(spec, { shape: 'type', typed: 'ip' }).result.correct).toBe(true);
		expect(checkResponse(spec, { shape: 'type', typed: 'IS' }).result.correct).toBe(false);
		expect(checkResponse(spec, { shape: 'type', typed: 'TCP' }).result.correct).toBe(false);
	});

	it('is deterministic', () => {
		const a = build(course, 1, `node:${f.nodeId('Client')}`, 'nodeCloze');
		expect(a.result.kind).toBe('nodeCloze');
		expect(build(course, 1, `node:${f.nodeId('Client')}`, 'nodeCloze')).toEqual(a);
	});
});

// ---------------------------------------------------------------------------------------------
// edgeCloze
// ---------------------------------------------------------------------------------------------

describe('buildEdgeCloze (BUILD_PLAN §7.2, answers.ts edge answer)', () => {
	const f = flow([
		['Parser', 'Optimizer', 'relational algebra'],
		['Optimizer', 'Executor'],
		['Executor', 'Storage', 'pages']
	]);
	const course = buildCourse([{ content: f.content }]);
	const edge = (i: number) =>
		shapeOf(buildEdgeCloze(ctxOf(course, 1, `edge:${f.edgeId(i)}`, 'edgeCloze')), 'type');

	it('with a label: asks for the label, hides it and targets the arrow', () => {
		const spec = edge(0);
		expect(spec.kind).toBe('edgeCloze');
		expect(spec.answer).toBe('relational algebra');
		const figure = diagramFigure(spec.figure);
		expect(figure.target).toBe(f.edgeId(0));
		expect(figure.edges.find((e) => e.id === f.edgeId(0))?.label).toBeNull();
		expect(figure.edges.find((e) => e.id === f.edgeId(2))?.label).toBe('pages');
		for (const n of figure.nodes) expect(n.label).not.toBeNull();
	});

	it('without a label: asks for the target node and hides that node’s label too', () => {
		const spec = edge(1);
		expect(spec.answer).toBe('Executor');
		const figure = diagramFigure(spec.figure);
		expect(figure.target).toBe(f.edgeId(1));
		expect(figure.nodes.find((n) => n.id === f.nodeId('Executor'))?.label).toBeNull();
		expect(figure.nodes.find((n) => n.id === f.nodeId('Optimizer'))?.label).toBe('Optimizer');
		expect(figure.nodes.find((n) => n.id === f.nodeId('Storage'))?.label).toBe('Storage');
	});

	it('draws the whole diagram with its layout and keeps every arrow', () => {
		const figure = diagramFigure(edge(0).figure);
		expect(figure.edges.map((e) => e.id)).toEqual(f.edges.map((e) => e.id));
		expect(figure.layout).toEqual(
			layoutDiagram({ kind: 'flow', nodes: f.nodes, edges: f.edges }).result
		);
	});

	it('grades the typed label (fuzzy by length) and guards sibling labels', () => {
		const spec = edge(0);
		expect(checkResponse(spec, { shape: 'type', typed: 'Relational Algebra' }).result.correct).toBe(
			true
		);
		const sibling = checkResponse(spec, { shape: 'type', typed: 'pages' }).result;
		expect(sibling.correct).toBe(false);
		expect(sibling.chosenFromCardId).toBe(cardIdOf(1, f.nodes.length + 2));
	});

	it('falls back to flip when the arrow is gone', () => {
		expect(buildEdgeCloze(ctxOf(course, 1, `edge:${uuid(0xdead)}`, 'edgeCloze'))).toMatchObject({
			fallback: 'flip'
		});
	});

	it('is deterministic', () => {
		const a = build(course, 1, `edge:${f.edgeId(0)}`, 'edgeCloze');
		expect(a.result.kind).toBe('edgeCloze');
		expect(build(course, 1, `edge:${f.edgeId(0)}`, 'edgeCloze')).toEqual(a);
	});
});

// ---------------------------------------------------------------------------------------------
// structureRebuild
// ---------------------------------------------------------------------------------------------

describe('buildStructureRebuild (BUILD_PLAN §7.2, Decisions "Phase 6 Q8")', () => {
	const f = flow([
		['Client', 'Server', 'request'],
		['Server', 'Database', 'query'],
		['Server', 'Client', 'response']
	]);
	const course = buildCourse([{ content: f.content }]);
	const rebuild = () =>
		shapeOf(buildStructureRebuild(ctxOf(course, 1, 'rebuild', 'structureRebuild')), 'connect');

	it('builds a connect spec: every node labelled, no arrows, no target', () => {
		const spec = rebuild();
		expect(spec.kind).toBe('structureRebuild');
		expect(spec.figure.edges).toEqual([]);
		expect(spec.figure.target).toBeNull();
		expect(spec.figure.nodes.map((n) => [n.id, n.label])).toEqual(
			f.nodes.map((n) => [n.id, n.label])
		);
	});

	it('lays the nodes out as the full diagram will sit', () => {
		expect(rebuild().figure.layout).toEqual(
			layoutDiagram({ kind: 'flow', nodes: f.nodes, edges: f.edges }).result
		);
	});

	it('lists the reference arrows as from → to only, in edge order (labels are not asked)', () => {
		const { edges } = rebuild();
		expect(edges).toEqual(f.edges.map((e) => ({ from: e.from, to: e.to })));
		for (const e of edges) expect(Object.keys(e).sort()).toEqual(['from', 'to']);
	});

	it('is graded as a set: the reference arrows are right, a reversed one is not', () => {
		const spec = rebuild();
		expect(
			checkResponse(spec, { shape: 'connect', edges: [...spec.edges].reverse() }).result.correct
		).toBe(true);
		const flipped = spec.edges.map((e, i) => (i === 0 ? { from: e.to, to: e.from } : e));
		expect(checkResponse(spec, { shape: 'connect', edges: flipped }).result.correct).toBe(false);
	});

	it('falls back to flip for a flow with no arrows', () => {
		const none = {
			type: 'diagram',
			payload: {
				kind: 'flow',
				name: 'Empty',
				nodes: [{ id: uuid(0x2000), label: 'Alone' }],
				edges: []
			}
		} as NoteContent;
		const c = buildCourse([{ content: none }]);
		expect(buildStructureRebuild(ctxOf(c, 1, 'rebuild', 'structureRebuild'))).toMatchObject({
			fallback: 'flip'
		});
	});

	it('falls back to flip for a stack', () => {
		const s = stack(['Application', 'Transport']);
		const c = buildCourse([{ content: s.content }]);
		expect(buildStructureRebuild(ctxOf(c, 1, 'rebuild', 'structureRebuild'))).toMatchObject({
			fallback: 'flip'
		});
	});

	it('is deterministic', () => {
		const a = build(course, 1, 'rebuild', 'structureRebuild');
		expect(a.result.kind).toBe('structureRebuild');
		expect(build(course, 1, 'rebuild', 'structureRebuild')).toEqual(a);
	});
});

// ---------------------------------------------------------------------------------------------
// layerOrder
// ---------------------------------------------------------------------------------------------

describe('buildLayerOrder (BUILD_PLAN §7.2)', () => {
	const LAYERS = ['Application', 'Transport', 'Network', 'Link', 'Physical'];
	const s = stack(LAYERS);
	const course = buildCourse([{ content: s.content }]);
	const order = (options: BuildOptions = {}, c: TestCourse = course) =>
		shapeOf(buildLayerOrder(ctxOf(c, 1, 'layers', 'layerOrder', options)), 'order');

	it('builds an order spec whose correct order reads the layers top to bottom', () => {
		const spec = order();
		expect(spec.kind).toBe('layerOrder');
		expect(spec.correctOrder.map((i) => spec.items[i])).toEqual(LAYERS);
		expect([...spec.items].sort()).toEqual([...LAYERS].sort());
		expect(spec.extras).toEqual([]);
	});

	it('never shows the items in the right order, for any seed', () => {
		fc.assert(
			fc.property(fc.nat(10_000), (attempt) => {
				expect(order({ attempt }).items).not.toEqual(LAYERS);
			}),
			{ numRuns: NUM_RUNS }
		);
	});

	it('with two layers always shows them swapped', () => {
		const two = stack(['Application', 'Transport']);
		const c = buildCourse([{ content: two.content }]);
		for (let attempt = 0; attempt < 20; attempt += 1) {
			expect(order({ attempt }, c).items).toEqual(['Transport', 'Application']);
		}
	});

	it('draws the stack with every label hidden', () => {
		const figure = diagramFigure(order().figure);
		expect(figure.shape).toBe('stack');
		expect(figure.nodes.map((n) => n.id)).toEqual(s.nodes.map((n) => n.id));
		for (const n of figure.nodes) expect(n.label).toBeNull();
		for (const label of LAYERS) expect(JSON.stringify(figure)).not.toContain(label);
	});

	it('uses sequence grading: the right order is correct, one moved layer is the only mark', () => {
		const spec = order();
		const right = checkResponse(spec, { shape: 'order', order: spec.correctOrder }).result;
		expect(right.correct).toBe(true);
		expect(right.reveal).toEqual(LAYERS);
		const [first, ...rest] = spec.correctOrder;
		const moved = checkResponse(spec, { shape: 'order', order: [...rest, first as number] }).result;
		expect(moved.correct).toBe(false);
		expect(moved.marks).toEqual([first]);
	});

	it('falls back to flip for fewer than two layers', () => {
		const one = stack(['Application']);
		const c = buildCourse([{ content: one.content }]);
		expect(buildLayerOrder(ctxOf(c, 1, 'layers', 'layerOrder'))).toMatchObject({
			fallback: 'flip'
		});
	});

	it('falls back to flip when the diagram is not a stack', () => {
		const f = flow([['A', 'B']]);
		const c = buildCourse([{ content: f.content }]);
		expect(buildLayerOrder(ctxOf(c, 1, 'layers', 'layerOrder'))).toMatchObject({
			fallback: 'flip'
		});
	});

	it('is deterministic for the same seed and varies the order across seeds', () => {
		expect(order({ attempt: 3 })).toEqual(order({ attempt: 3 }));
		const seen = new Set(
			Array.from({ length: 30 }, (_x, a) => order({ attempt: a }).items.join('|'))
		);
		expect(seen.size).toBeGreaterThan(1);
	});
});

// ---------------------------------------------------------------------------------------------
// Through buildExercise, all kinds, determinism with the trace
// ---------------------------------------------------------------------------------------------

describe('figure kinds through buildExercise', () => {
	const f = flow([
		['Client', 'Server', 'request'],
		['Server', 'Database']
	]);
	const s = stack(['Application', 'Transport', 'Network']);
	const course = buildCourse([
		{ content: occlusion(IMAGE) },
		{ content: f.content },
		{ content: s.content }
	]);

	const CASES: readonly [string, number, string, ExerciseSpec['kind'], ExerciseShape][] = [
		['occlusionBank', 1, `box:${A(0)}`, 'occlusionBank', 'choose'],
		['occlusionDrag', 1, `box:${A(0)}`, 'occlusionDrag', 'place'],
		['occlusionType', 1, `box:${A(0)}`, 'occlusionType', 'type'],
		['nodeCloze', 2, `node:${f.nodeId('Client')}`, 'nodeCloze', 'type'],
		['edgeCloze', 2, `edge:${f.edgeId(0)}`, 'edgeCloze', 'type'],
		['structureRebuild', 2, 'rebuild', 'structureRebuild', 'connect'],
		['layerOrder', 3, 'layers', 'layerOrder', 'order']
	];

	it.each(CASES)('%s builds itself with no fallback', (kind, n, variant, shownKind, shape) => {
		const { result, trace } = build(course, n, variant, kind as ExerciseSpec['kind']);
		expect(result.kind).toBe(shownKind);
		expect(result.shape).toBe(shape);
		expect(trace.some((entry) => entry.rule === 'exercise.fallback')).toBe(false);
	});

	it.each(CASES)('%s: same input, same spec and same trace', (kind, n, variant, shownKind) => {
		const a = build(course, n, variant, kind as ExerciseSpec['kind'], { attempt: 5 });
		const b = build(course, n, variant, kind as ExerciseSpec['kind'], { attempt: 5 });
		expect(a.result.kind).toBe(shownKind);
		expect(b).toEqual(a);
	});

	it('every spec keeps the card id of the card it was built for', () => {
		const spec = build(course, 1, `box:${A(2)}`, 'occlusionDrag').result;
		expect(spec.kind).toBe('occlusionDrag');
		expect(spec.cardId).toBe(cardOf(course, 1, `box:${A(2)}`).id);
	});
});
