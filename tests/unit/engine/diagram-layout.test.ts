import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
	DIAGRAM_GAP,
	DIAGRAM_MAX_EDGES,
	DIAGRAM_MAX_NODES,
	DIAGRAM_NODE
} from '#lib/config/defaults.ts';
import {
	layoutDiagram,
	type DiagramLayout,
	type LayoutBox,
	type LayoutInput
} from '#lib/engine/diagram-layout.ts';
import { NUM_RUNS, uuid } from './fixtures.ts';

const nodeIds = (n: number): string[] => Array.from({ length: n }, (_x, i) => uuid(0x100 + i));

function flowOf(
	labels: readonly string[],
	arrows: readonly (readonly [number, number, string?])[]
): LayoutInput {
	const ids = nodeIds(labels.length);
	return {
		kind: 'flow',
		nodes: labels.map((label, i) => ({ id: ids[i] as string, label })),
		edges: arrows.map(([from, to, label], i) => ({
			id: uuid(0x200 + i),
			from: ids[from] as string,
			to: ids[to] as string,
			...(label ? { label } : {})
		}))
	};
}

function stackOf(labels: readonly string[]): LayoutInput {
	const ids = nodeIds(labels.length);
	return {
		kind: 'stack',
		nodes: labels.map((label, i) => ({ id: ids[i] as string, label })),
		edges: []
	};
}

function laid(input: LayoutInput): DiagramLayout {
	const { result } = layoutDiagram(input);
	if (!result) throw new Error('expected a layout');
	return result;
}

const boxOf = (layout: DiagramLayout, id: string): LayoutBox => {
	const box = layout.nodes[id];
	if (!box) throw new Error(`no box for ${id}`);
	return box;
};

const overlap = (a: LayoutBox, b: LayoutBox): boolean =>
	a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function assertNoOverlapAndInBounds(layout: DiagramLayout): void {
	const boxes = Object.values(layout.nodes);
	boxes.forEach((a, i) => {
		expect(a.x).toBeGreaterThanOrEqual(0);
		expect(a.y).toBeGreaterThanOrEqual(0);
		expect(a.x + a.w).toBeLessThanOrEqual(layout.width + 1e-6);
		expect(a.y + a.h).toBeLessThanOrEqual(layout.height + 1e-6);
		for (const b of boxes.slice(i + 1)) expect(overlap(a, b)).toBe(false);
	});
}

/** Node ids grouped by the y of their box, top layer first, each layer left to right. */
function layersOf(layout: DiagramLayout): string[][] {
	const byY = new Map<number, string[]>();
	for (const [id, box] of Object.entries(layout.nodes))
		byY.set(box.y, [...(byY.get(box.y) ?? []), id]);
	return [...byY.entries()]
		.sort(([a], [b]) => a - b)
		.map(([, ids]) => ids.sort((p, q) => boxOf(layout, p).x - boxOf(layout, q).x));
}

const widthFor = (label: string): number =>
	Math.min(
		DIAGRAM_NODE.maxWidth,
		Math.max(DIAGRAM_NODE.minWidth, label.length * DIAGRAM_NODE.charWidth)
	);

// ---------------------------------------------------------------------------------------------

describe('layoutDiagram: node boxes (BUILD_PLAN §7.2)', () => {
	it('sizes a flow node by its label, clamped to [minWidth, maxWidth], at the fixed height', () => {
		const long = 'x'.repeat(60);
		const mid = 'y'.repeat(14);
		const layout = laid(
			flowOf(
				['IP', mid, long],
				[
					[0, 1],
					[1, 2]
				]
			)
		);
		const [ip, m, l] = nodeIds(3).map((id) => boxOf(layout, id));
		expect(ip?.w).toBe(DIAGRAM_NODE.minWidth);
		expect(m?.w).toBe(widthFor(mid));
		expect(l?.w).toBe(DIAGRAM_NODE.maxWidth);
		for (const box of [ip, m, l]) expect(box?.h).toBe(DIAGRAM_NODE.height);
	});
});

describe('layoutDiagram: stack', () => {
	const labels = ['Application', 'Transport', 'Network', 'Data link', 'Physical'];
	const layoutOf = () => laid(stackOf(labels));
	const boxesOf = (layout: DiagramLayout) => nodeIds(labels.length).map((id) => boxOf(layout, id));

	it('puts one node per row, top to bottom in node order', () => {
		const layout = layoutOf();
		const boxes = boxesOf(layout);
		for (let i = 1; i < boxes.length; i += 1) {
			expect((boxes[i] as LayoutBox).y).toBeGreaterThan((boxes[i - 1] as LayoutBox).y);
		}
		expect(layersOf(layout)).toEqual(nodeIds(labels.length).map((id) => [id]));
	});

	it('gives every layer the width of the widest label and centres them', () => {
		const boxes = boxesOf(layoutOf());
		const widest = Math.max(...labels.map((label) => widthFor(label)));
		for (const box of boxes) expect(box.w).toBe(widest);
		const centres = boxes.map((box) => box.x + box.w / 2);
		for (const c of centres) expect(c).toBeCloseTo(centres[0] as number, 6);
	});

	it('has no overlaps, stays in bounds, and has no edges', () => {
		const layout = layoutOf();
		assertNoOverlapAndInBounds(layout);
		expect(layout.edges).toEqual({});
	});

	it('keeps the order of the nodes array whatever the labels say', () => {
		const reversed = laid(stackOf([...labels].reverse()));
		const ys = nodeIds(labels.length).map((id) => boxOf(reversed, id).y);
		expect([...ys].sort((a, b) => a - b)).toEqual(ys);
	});
});

describe('layoutDiagram: flow layers', () => {
	it('puts a chain on successive layers, top to bottom', () => {
		const layout = laid(
			flowOf(
				['A', 'B', 'C', 'D'],
				[
					[0, 1],
					[1, 2],
					[2, 3]
				]
			)
		);
		const ys = nodeIds(4).map((id) => boxOf(layout, id).y);
		expect([...ys].sort((a, b) => a - b)).toEqual(ys);
		expect(new Set(ys).size).toBe(4);
	});

	it('uses the longest path from a source for a node’s layer', () => {
		// A -> B -> C and A -> C: C is on layer 2, not 1.
		const layout = laid(
			flowOf(
				['A', 'B', 'C'],
				[
					[0, 1],
					[1, 2],
					[0, 2]
				]
			)
		);
		const [a, b, c] = nodeIds(3).map((id) => boxOf(layout, id));
		expect(b?.y).toBeGreaterThan((a as LayoutBox).y);
		expect(c?.y).toBeGreaterThan((b as LayoutBox).y);
	});

	it('puts siblings on one layer and a join below both of them', () => {
		const layout = laid(
			flowOf(
				['A', 'B', 'C', 'D'],
				[
					[0, 1],
					[0, 2],
					[1, 3],
					[2, 3]
				]
			)
		);
		const [a, b, c, d] = nodeIds(4).map((id) => boxOf(layout, id));
		expect(b?.y).toBe(c?.y);
		expect(b?.y).toBeGreaterThan((a as LayoutBox).y);
		expect(d?.y).toBeGreaterThan((b as LayoutBox).y);
	});

	it('puts every source (no incoming arrow) on the top layer', () => {
		const layout = laid(
			flowOf(
				['A', 'B', 'C'],
				[
					[0, 2],
					[1, 2]
				]
			)
		);
		const [a, b, c] = nodeIds(3).map((id) => boxOf(layout, id));
		expect(a?.y).toBe(b?.y);
		expect(c?.y).toBeGreaterThan((a as LayoutBox).y);
	});

	it('separates layers by DIAGRAM_GAP.y and boxes within a layer by DIAGRAM_GAP.x', () => {
		const layout = laid(
			flowOf(
				['A', 'B', 'C', 'D'],
				[
					[0, 1],
					[0, 2],
					[1, 3],
					[2, 3]
				]
			)
		);
		const layers = layersOf(layout);
		expect(layers).toHaveLength(3);
		// SPEC-GAP: "layers are DIAGRAM_GAP.y apart" read as the space between one layer's bottom
		// edge and the next layer's top edge.
		const first = boxOf(layout, (layers[0] as string[])[0] as string);
		const second = boxOf(layout, (layers[1] as string[])[0] as string);
		expect(second.y - (first.y + first.h)).toBe(DIAGRAM_GAP.y);
		const [left, right] = (layers[1] as string[]).map((id) => boxOf(layout, id));
		expect((right as LayoutBox).x - ((left as LayoutBox).x + (left as LayoutBox).w)).toBe(
			DIAGRAM_GAP.x
		);
	});

	it('centres every layer on the same vertical axis', () => {
		const layout = laid(
			flowOf(
				['A', 'B', 'C', 'D', 'E'],
				[
					[0, 1],
					[0, 2],
					[0, 3],
					[1, 4],
					[2, 4],
					[3, 4]
				]
			)
		);
		const centres = layersOf(layout).map((ids) => {
			const boxes = ids.map((id) => boxOf(layout, id));
			const left = Math.min(...boxes.map((b) => b.x));
			const right = Math.max(...boxes.map((b) => b.x + b.w));
			return (left + right) / 2;
		});
		for (const c of centres) expect(c).toBeCloseTo(centres[0] as number, 6);
	});

	it('orders a layer to untangle crossings (barycentre sweeps)', () => {
		// Top: P, Q. Bottom listed X, Y but P -> Y and Q -> X; the ordering must not cross them.
		const layout = laid(
			flowOf(
				['P', 'Q', 'X', 'Y'],
				[
					[0, 3],
					[1, 2]
				]
			)
		);
		const [p, q, x, y] = nodeIds(4).map((id) => boxOf(layout, id));
		const pLeftOfQ = (p as LayoutBox).x < (q as LayoutBox).x;
		const yLeftOfX = (y as LayoutBox).x < (x as LayoutBox).x;
		expect(pLeftOfQ).toBe(yLeftOfX);
	});

	it('does not throw on a cycle and keeps the first node of a cycle on the top layer', () => {
		const layout = laid(
			flowOf(
				['A', 'B', 'C'],
				[
					[0, 1],
					[1, 2],
					[2, 0]
				]
			)
		);
		// SPEC-GAP: a pure cycle has no source; reading: the first node in `nodes` order starts it.
		const [a, b, c] = nodeIds(3).map((id) => boxOf(layout, id));
		expect((a as LayoutBox).y).toBeLessThan((b as LayoutBox).y);
		expect((b as LayoutBox).y).toBeLessThan((c as LayoutBox).y);
		assertNoOverlapAndInBounds(layout);
	});

	it('copes with a self-loop and with a two-node cycle', () => {
		assertNoOverlapAndInBounds(
			laid(
				flowOf(
					['A', 'B'],
					[
						[0, 0],
						[0, 1],
						[1, 0]
					]
				)
			)
		);
	});

	it('copes with nodes that have no arrows at all', () => {
		const layout = laid(flowOf(['A', 'B', 'C'], [[0, 1]]));
		expect(Object.keys(layout.nodes)).toHaveLength(3);
		assertNoOverlapAndInBounds(layout);
	});

	it('copes with an empty diagram', () => {
		const layout = laid({ kind: 'flow', nodes: [], edges: [] });
		expect(layout.nodes).toEqual({});
		expect(layout.edges).toEqual({});
		expect(Number.isFinite(layout.width)).toBe(true);
		expect(Number.isFinite(layout.height)).toBe(true);
	});
});

describe('layoutDiagram: arrows', () => {
	it('runs a forward arrow from the bottom centre of its source to the top centre of its target', () => {
		const layout = laid(flowOf(['A', 'B'], [[0, 1, 'go']]));
		const [a, b] = nodeIds(2).map((id) => boxOf(layout, id)) as [LayoutBox, LayoutBox];
		const edge = layout.edges[uuid(0x200)];
		expect(edge?.points[0]).toEqual({ x: a.x + a.w / 2, y: a.y + a.h });
		expect(edge?.points.at(-1)).toEqual({ x: b.x + b.w / 2, y: b.y });
	});

	it('puts the label at the middle point of a two-point polyline', () => {
		const layout = laid(flowOf(['A', 'B'], [[0, 1, 'go']]));
		const edge = layout.edges[uuid(0x200)];
		const [start, end] = [edge?.points[0], edge?.points.at(-1)] as [
			{ x: number; y: number },
			{ x: number; y: number }
		];
		expect(edge?.points).toHaveLength(2);
		expect(edge?.labelAt.x).toBeCloseTo((start.x + end.x) / 2, 6);
		expect(edge?.labelAt.y).toBeCloseTo((start.y + end.y) / 2, 6);
	});

	it('leaves a backward arrow from the source’s side', () => {
		const layout = laid(
			flowOf(
				['A', 'B', 'C'],
				[
					[0, 1],
					[1, 2],
					[2, 0, 'again']
				]
			)
		);
		const c = boxOf(layout, nodeIds(3)[2] as string);
		const back = layout.edges[uuid(0x202)];
		const start = back?.points[0];
		expect(back?.points.length).toBeGreaterThanOrEqual(2);
		expect([c.x, c.x + c.w]).toContain(start?.x);
	});

	it('gives every arrow a polyline of at least two points', () => {
		const layout = laid(
			flowOf(
				['A', 'B', 'C', 'D'],
				[
					[0, 1],
					[0, 2],
					[1, 3],
					[2, 3],
					[3, 0]
				]
			)
		);
		for (const edge of Object.values(layout.edges))
			expect(edge.points.length).toBeGreaterThanOrEqual(2);
		expect(Object.keys(layout.edges)).toHaveLength(5);
	});
});

describe('layoutDiagram: determinism and the size cap', () => {
	it('gives the same layout and trace for the same input', () => {
		const input = flowOf(
			['A', 'B', 'C', 'D', 'E'],
			[
				[0, 1, 'x'],
				[0, 2],
				[1, 3],
				[2, 3],
				[3, 4],
				[4, 1]
			]
		);
		expect(layoutDiagram(input)).toEqual(layoutDiagram(structuredClone(input)));
		expect(Array.isArray(layoutDiagram(input).trace)).toBe(true);
	});

	it('does not depend on the order the arrows are listed in', () => {
		const input = flowOf(
			['A', 'B', 'C', 'D', 'E'],
			[
				[0, 1, 'x'],
				[0, 2],
				[1, 3],
				[2, 3],
				[3, 4],
				[4, 1]
			]
		);
		fc.assert(
			fc.property(
				fc.shuffledSubarray([...input.edges], { minLength: input.edges.length }),
				(edges) => {
					expect(layoutDiagram({ ...input, edges }).result).toEqual(layoutDiagram(input).result);
				}
			),
			{ numRuns: NUM_RUNS }
		);
	});

	it('returns null above DIAGRAM_MAX_NODES nodes and a layout at exactly that many', () => {
		const at = (n: number) =>
			layoutDiagram(
				flowOf(
					nodeIds(n).map((_x, i) => `N${i}`),
					[]
				)
			);
		expect(at(DIAGRAM_MAX_NODES).result).not.toBeNull();
		expect(at(DIAGRAM_MAX_NODES + 1).result).toBeNull();
		const stack = (n: number) => layoutDiagram(stackOf(nodeIds(n).map((_x, i) => `L${i}`)));
		expect(stack(DIAGRAM_MAX_NODES).result).not.toBeNull();
		expect(stack(DIAGRAM_MAX_NODES + 1).result).toBeNull();
	});

	it('returns null above DIAGRAM_MAX_EDGES arrows and a layout at exactly that many', () => {
		const withEdges = (n: number) =>
			layoutDiagram(
				flowOf(
					['A', 'B', 'C'],
					Array.from({ length: n }, (_x, i) => [i % 2, 2] as const)
				)
			);
		expect(withEdges(DIAGRAM_MAX_EDGES).result).not.toBeNull();
		expect(withEdges(DIAGRAM_MAX_EDGES + 1).result).toBeNull();
	});
});

describe('layoutDiagram: any flow within the cap (property)', () => {
	const flowArb = fc
		.integer({ min: 1, max: 12 })
		.chain((n) =>
			fc.tuple(
				fc.constant(n),
				fc.array(fc.tuple(fc.nat(n - 1), fc.nat(n - 1)), { maxLength: 20 }),
				fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: n, maxLength: n })
			)
		);

	it('never overlaps two boxes, keeps every box in bounds and is deterministic', () => {
		fc.assert(
			fc.property(flowArb, ([n, arrows, labels]) => {
				const input = flowOf(labels.slice(0, n), arrows);
				const first = layoutDiagram(input);
				expect(first.result).not.toBeNull();
				assertNoOverlapAndInBounds(first.result as DiagramLayout);
				for (const edge of Object.values((first.result as DiagramLayout).edges)) {
					for (const p of edge.points) {
						expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
					}
				}
				for (const box of Object.values((first.result as DiagramLayout).nodes)) {
					expect(box.w).toBeGreaterThanOrEqual(DIAGRAM_NODE.minWidth);
					expect(box.w).toBeLessThanOrEqual(DIAGRAM_NODE.maxWidth);
				}
				expect(layoutDiagram(input)).toEqual(first);
			}),
			{ numRuns: NUM_RUNS }
		);
	});
});
