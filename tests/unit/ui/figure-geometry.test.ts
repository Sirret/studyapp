import { describe, expect, it } from 'vitest';
import { OCCLUSION_NEW_BOX } from '#lib/config/defaults.ts';
import type { DiagramFigure, ExerciseSpec, MediaId } from '#lib/services/study-types.ts';
import {
	connectorPoints,
	diagramLines,
	dropPoint,
	missingArrows,
	occlusionBoxes,
	originalOf,
	percentRect,
	polylinePoints,
	previewFigure,
	staticFigure,
	tapNode
} from '#lib/ui/figures/figure-geometry.ts';
import { delta, drawnRect, fractionAt, rectBetween } from '#lib/ui/figures/occlusion-pointer.ts';

const flow: DiagramFigure = {
	kind: 'diagram',
	shape: 'flow',
	title: 'Query plan',
	nodes: [
		{ id: 'a', label: 'Scan' },
		{ id: 'b', label: null },
		{ id: 'c', label: 'Output' },
		{ id: 'd', label: 'Alone' }
	],
	edges: [
		{ id: 'e1', from: 'a', to: 'b', label: 'rows' },
		{ id: 'e2', from: 'b', to: 'c', label: null }
	],
	target: 'b',
	layout: null
};

describe('percentRect', () => {
	it('turns fractions into percentages', () => {
		expect(percentRect({ x: 0.1, y: 0.25, w: 0.5, h: 0.125 })).toEqual({
			left: '10%',
			top: '25%',
			width: '50%',
			height: '12.5%'
		});
	});

	it('scales layout units by the container size', () => {
		const r = percentRect({ x: 50, y: 0, w: 100, h: 44 }, { width: 200, height: 88 });
		expect(r).toEqual({ left: '25%', top: '0%', width: '50%', height: '50%' });
	});
});

describe('connectorPoints', () => {
	const top = { x: 0, y: 0, w: 100, h: 40 };
	it('runs from the bottom of the source to the top of a lower target', () => {
		expect(connectorPoints(top, { x: 0, y: 100, w: 100, h: 40 })).toEqual([
			{ x: 50, y: 40 },
			{ x: 50, y: 100 }
		]);
	});

	it('runs upward to a higher target', () => {
		expect(connectorPoints({ x: 0, y: 100, w: 100, h: 40 }, top)).toEqual([
			{ x: 50, y: 100 },
			{ x: 50, y: 40 }
		]);
	});

	it('runs side to side within a row, either way', () => {
		const right = { x: 200, y: 0, w: 100, h: 40 };
		expect(connectorPoints(top, right)).toEqual([
			{ x: 100, y: 20 },
			{ x: 200, y: 20 }
		]);
		expect(connectorPoints(right, top)).toEqual([
			{ x: 200, y: 20 },
			{ x: 100, y: 20 }
		]);
	});

	it('formats SVG points', () => {
		expect(
			polylinePoints([
				{ x: 1, y: 2 },
				{ x: 3, y: 4 }
			])
		).toBe('1,2 3,4');
	});
});

describe('diagramLines (screen-reader text)', () => {
	it('lists a flow as arrows, hidden parts as "hidden", then unlinked boxes', () => {
		expect(diagramLines(flow)).toEqual(['Scan → hidden: rows', 'hidden → Output', 'Alone']);
	});

	it('lists a stack top first by layer number', () => {
		const stack: DiagramFigure = {
			...flow,
			shape: 'stack',
			nodes: [
				{ id: 'a', label: 'Application' },
				{ id: 'b', label: null }
			],
			edges: []
		};
		expect(diagramLines(stack)).toEqual(['Layer 1: Application', 'Layer 2: hidden']);
	});
});

describe('dropPoint', () => {
	const rect = { left: 10, top: 20, width: 200, height: 100 };
	it('gives the point in rendered pixels with the rendered size', () => {
		expect(dropPoint({ x: 60, y: 70 }, rect)).toEqual({
			point: { x: 50, y: 50 },
			size: { width: 200, height: 100 }
		});
	});

	it('counts the edge as inside and outside as no drop', () => {
		expect(dropPoint({ x: 210, y: 120 }, rect)?.point).toEqual({ x: 200, y: 100 });
		expect(dropPoint({ x: 9, y: 50 }, rect)).toBeNull();
		expect(dropPoint({ x: 50, y: 121 }, rect)).toBeNull();
	});
});

describe('occlusionBoxes', () => {
	const figure = {
		boxes: [
			{ id: 'x', x: 0, y: 0, w: 0.1, h: 0.1 },
			{ id: 'y', x: 0.5, y: 0.5, w: 0.1, h: 0.1 },
			{ id: 'z', x: 0.8, y: 0.8, w: 0.1, h: 0.1 }
		],
		covered: ['x', 'y'],
		target: 'x'
	};

	it('highlights the asked box with "?", covers the covered ones, leaves the rest open', () => {
		const looks = occlusionBoxes(figure).map((b) => [b.id, b.look, b.text]);
		expect(looks).toEqual([
			['x', 'target', '?'],
			['y', 'covered', undefined],
			['z', 'open', undefined]
		]);
	});

	it('writes the answer into the asked box once checked', () => {
		const [asked] = occlusionBoxes(figure, 'Router');
		expect(asked).toMatchObject({ look: 'revealed', text: 'Router', name: 'Router' });
	});
});

describe('tapNode (connect)', () => {
	it('picks a source, then adds the arrow to the next node', () => {
		const picked = tapNode({ pending: null, arrows: [] }, 'a');
		expect(picked).toEqual({ pending: 'a', arrows: [] });
		expect(tapNode(picked, 'b')).toEqual({ pending: null, arrows: [{ from: 'a', to: 'b' }] });
	});

	it('cancels on a second tap of the source and never repeats an arrow', () => {
		expect(tapNode({ pending: 'a', arrows: [] }, 'a')).toEqual({ pending: null, arrows: [] });
		const arrows = [{ from: 'a', to: 'b' }];
		expect(tapNode({ pending: 'a', arrows }, 'b').arrows).toEqual(arrows);
	});

	it('lists the reference arrows not drawn, direction included', () => {
		const reference = [
			{ from: 'a', to: 'b' },
			{ from: 'b', to: 'c' }
		];
		expect(missingArrows([{ from: 'b', to: 'a' }], reference)).toEqual(reference);
		expect(missingArrows([{ from: 'a', to: 'b' }], reference)).toEqual([{ from: 'b', to: 'c' }]);
	});
});

describe('staticFigure and originalOf', () => {
	const typeSpec = (figure?: DiagramFigure) =>
		({ shape: 'type', kind: 'nodeCloze', figure }) as unknown as ExerciseSpec;

	it('gives the figure of type, choose and order specs only', () => {
		expect(staticFigure(typeSpec(flow))).toBe(flow);
		expect(staticFigure(typeSpec())).toBeNull();
		const place = { shape: 'place', figure: flow } as unknown as ExerciseSpec;
		expect(staticFigure(place)).toBeNull();
	});

	it('offers the original only for a diagram made from a picture', () => {
		const sourceMediaId = 'pic' as MediaId;
		expect(originalOf(typeSpec(flow))).toBeNull();
		expect(originalOf(typeSpec({ ...flow, sourceMediaId }))).toEqual({
			mediaId: sourceMediaId,
			title: 'Query plan'
		});
		const connect = { shape: 'connect', figure: { ...flow, sourceMediaId } } as unknown;
		expect(originalOf(connect as ExerciseSpec)?.mediaId).toBe(sourceMediaId);
	});
});

describe('previewFigure', () => {
	it('shows every label, no target, missing arrow labels as null', () => {
		const figure = previewFigure('flow', 'Plan', {
			errors: [],
			nodes: [
				{ id: 'p1', label: 'A' },
				{ id: 'p2', label: 'B' }
			],
			edges: [{ id: 'p3', from: 'p1', to: 'p2' }],
			layout: null
		});
		expect(figure).toMatchObject({ shape: 'flow', title: 'Plan', target: null });
		expect(figure.edges[0]?.label).toBeNull();
	});
});

describe('occlusion editor pointer', () => {
	const rect = { left: 100, top: 50, width: 400, height: 200 };
	it('reads a pointer as fractions of the image, kept on it', () => {
		expect(fractionAt({ x: 300, y: 100 }, rect)).toEqual({ x: 0.5, y: 0.25 });
		expect(fractionAt({ x: 0, y: 999 }, rect)).toEqual({ x: 0, y: 1 });
		expect(fractionAt({ x: 1, y: 1 }, { ...rect, width: 0 })).toEqual({ x: 0, y: 0 });
	});

	it('spans a rectangle dragged in any direction', () => {
		expect(rectBetween({ x: 0.5, y: 0.6 }, { x: 0.2, y: 0.1 })).toEqual({
			x: 0.2,
			y: 0.1,
			w: 0.3,
			h: 0.5
		});
		const travel = delta({ kind: 'draw', start: { x: 0.1, y: 0.2 }, now: { x: 0.4, y: 0.1 } });
		expect(travel.x).toBeCloseTo(0.3);
		expect(travel.y).toBeCloseTo(-0.1);
	});

	it('keeps a drawn box, and turns a tap into a default-size box centred on it', () => {
		expect(drawnRect({ x: 0.125, y: 0.25 }, { x: 0.375, y: 0.5 })).toEqual({
			x: 0.125,
			y: 0.25,
			w: 0.25,
			h: 0.25
		});
		const tap = drawnRect({ x: 0.5, y: 0.5 }, { x: 0.501, y: 0.5 });
		expect(tap.w).toBe(OCCLUSION_NEW_BOX.w);
		expect(tap.h).toBe(OCCLUSION_NEW_BOX.h);
		expect(tap.x + tap.w / 2).toBeCloseTo(0.501);
		expect(tap.y + tap.h / 2).toBeCloseTo(0.5);
	});
});
