import {
	DIAGRAM_GAP,
	DIAGRAM_MAX_EDGES,
	DIAGRAM_MAX_NODES,
	DIAGRAM_NODE,
	DIAGRAM_STACK_GAP
} from '#lib/config/defaults.ts';
import {
	acyclicArrows,
	longestPathLayers,
	orderLayers,
	type IndexedArrow
} from './diagram-layering.ts';
import type { Traced } from './trace.ts';

type Point = { x: number; y: number };

/** What the layout reads: a diagram's structure, labels included (they set node widths). */
export interface LayoutInput {
	kind: 'stack' | 'flow';
	nodes: readonly { id: string; label: string }[];
	edges: readonly { id: string; from: string; to: string; label?: string }[];
}

/** A node's box in layout units (1 unit = 1 CSS px at scale 1); (x, y) is the top-left corner. */
export interface LayoutBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** A laid-out diagram: every node's box and every arrow's polyline (start, bends, end). */
export interface DiagramLayout {
	width: number;
	height: number;
	nodes: Record<string, LayoutBox>;
	edges: Record<string, { points: { x: number; y: number }[]; labelAt: { x: number; y: number } }>;
}

/**
 * Lays out a diagram, deterministically (the same input always gives the same layout, whatever
 * the order of equal-ranked nodes in memory).
 *
 * - **stack:** one node per row, top to bottom in `nodes` order, all the same width (the widest
 *   label's), centred; no edges.
 * - **flow:** layered, direction down. Each node's layer is its longest path from a source
 *   (a node with no incoming arrow); arrows that close a cycle are ignored for layering (a node
 *   reached again keeps its first layer, found in `nodes` order). Nodes within a layer are
 *   ordered by `DIAGRAM_LAYOUT_SWEEPS` down-and-up barycentre passes (ties keep `nodes` order),
 *   then placed left to right with `DIAGRAM_GAP.x` between boxes and each layer centred; layers
 *   are `DIAGRAM_GAP.y` apart. An arrow runs from the bottom centre of its source to the top
 *   centre of its target (a backward or same-layer arrow from the source's side); its label sits
 *   at the polyline's middle point.
 * - Node width: the label's length × `DIAGRAM_NODE.charWidth`, clamped to
 *   [`DIAGRAM_NODE.minWidth`, `DIAGRAM_NODE.maxWidth`]; height `DIAGRAM_NODE.height`.
 * - No two node boxes overlap; every box lies inside [0, width] × [0, height].
 *
 * Returns null when the diagram has more than `DIAGRAM_MAX_NODES` nodes or `DIAGRAM_MAX_EDGES`
 * edges: the screen says "too big to draw, edit as text" (Decisions log "Phase 6 Q4").
 *
 * @see BUILD_PLAN §7.2; Decisions log "Phase 6 Q4"
 */
export function layoutDiagram(input: LayoutInput): Traced<DiagramLayout | null> {
	if (input.nodes.length > DIAGRAM_MAX_NODES || input.edges.length > DIAGRAM_MAX_EDGES) {
		return {
			result: null,
			trace: [
				{ rule: 'diagram.layout.tooBig', nodes: input.nodes.length, edges: input.edges.length }
			]
		};
	}
	const result = input.kind === 'stack' ? layoutStack(input) : layoutFlow(input);
	return {
		result,
		trace: [
			{ rule: 'diagram.layout', kind: input.kind, width: result.width, height: result.height }
		]
	};
}

/** A node's width from its label length, clamped. */
function nodeWidth(label: string): number {
	const { minWidth, maxWidth, charWidth } = DIAGRAM_NODE;
	return Math.min(maxWidth, Math.max(minWidth, label.length * charWidth));
}

function layoutStack(input: LayoutInput): DiagramLayout {
	const w = Math.max(0, ...input.nodes.map((n) => nodeWidth(n.label)));
	const h = DIAGRAM_NODE.height;
	const nodes: Record<string, LayoutBox> = {};
	input.nodes.forEach((n, i) => (nodes[n.id] = { x: 0, y: i * (h + DIAGRAM_STACK_GAP), w, h }));
	const rows = input.nodes.length;
	return {
		width: w,
		height: rows === 0 ? 0 : rows * h + (rows - 1) * DIAGRAM_STACK_GAP,
		nodes,
		edges: {}
	};
}

function layoutFlow(input: LayoutInput): DiagramLayout {
	const index = new Map(input.nodes.map((n, i) => [n.id, i]));
	const arrows: IndexedArrow[] = input.edges.flatMap((e) => {
		const from = index.get(e.from);
		const to = index.get(e.to);
		return from === undefined || to === undefined ? [] : [{ from, to }];
	});
	const dag = acyclicArrows(input.nodes.length, arrows);
	const layerOf = longestPathLayers(input.nodes.length, dag);
	const layers = orderLayers(layerOf, dag);
	const widths = input.nodes.map((n) => nodeWidth(n.label));
	const rowWidth = (layer: number[]) =>
		layer.reduce((sum, node) => sum + (widths[node] ?? 0), 0) +
		Math.max(0, layer.length - 1) * DIAGRAM_GAP.x;
	const width = Math.max(0, ...layers.map(rowWidth));
	const h = DIAGRAM_NODE.height;
	const nodes: Record<string, LayoutBox> = {};
	layers.forEach((layer, l) => {
		let x = (width - rowWidth(layer)) / 2;
		for (const node of layer) {
			const w = widths[node] ?? 0;
			nodes[input.nodes[node]?.id ?? ''] = { x, y: l * (h + DIAGRAM_GAP.y), w, h };
			x += w + DIAGRAM_GAP.x;
		}
	});
	const height = layers.length === 0 ? 0 : layers.length * h + (layers.length - 1) * DIAGRAM_GAP.y;
	const edges: DiagramLayout['edges'] = {};
	let right = width;
	for (const e of input.edges) {
		const from = nodes[e.from];
		const to = nodes[e.to];
		if (!from || !to) continue;
		const points = route(from, to);
		right = Math.max(right, ...points.map((p) => p.x));
		edges[e.id] = { points, labelAt: midpoint(points) };
	}
	return { width: right, height, nodes, edges };
}

/**
 * An arrow's polyline. Forward (target lower): bottom centre to top centre. Same row: side to
 * facing side. Backward or a self-loop: out of the source's right side, up a lane right of both
 * boxes, into the target's right side.
 */
function route(from: LayoutBox, to: LayoutBox): Point[] {
	if (to.y > from.y)
		return [
			{ x: from.x + from.w / 2, y: from.y + from.h },
			{ x: to.x + to.w / 2, y: to.y }
		];
	const midY = (box: LayoutBox) => box.y + box.h / 2;
	if (to.y === from.y && to !== from) {
		return to.x > from.x
			? [
					{ x: from.x + from.w, y: midY(from) },
					{ x: to.x, y: midY(to) }
				]
			: [
					{ x: from.x, y: midY(from) },
					{ x: to.x + to.w, y: midY(to) }
				];
	}
	const lane = Math.max(from.x + from.w, to.x + to.w) + DIAGRAM_GAP.x / 2;
	const startY = to === from ? from.y + from.h / 4 : midY(from);
	const endY = to === from ? from.y + (from.h * 3) / 4 : midY(to);
	return [
		{ x: from.x + from.w, y: startY },
		{ x: lane, y: startY },
		{ x: lane, y: endY },
		{ x: to.x + to.w, y: endY }
	];
}

/** The point halfway along a polyline. */
function midpoint(points: readonly Point[]): Point {
	const segments = points.slice(1).map((p, i) => {
		const q = points[i] as Point;
		return { from: q, to: p, length: Math.hypot(p.x - q.x, p.y - q.y) };
	});
	let remaining = segments.reduce((sum, seg) => sum + seg.length, 0) / 2;
	for (const seg of segments) {
		if (remaining <= seg.length && seg.length > 0) {
			const t = remaining / seg.length;
			return {
				x: seg.from.x + (seg.to.x - seg.from.x) * t,
				y: seg.from.y + (seg.to.y - seg.from.y) * t
			};
		}
		remaining -= seg.length;
	}
	return points[0] ?? { x: 0, y: 0 };
}
