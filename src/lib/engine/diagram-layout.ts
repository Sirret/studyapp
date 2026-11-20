import type { Traced } from './trace.ts';

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
	void input;
	throw new Error('not implemented');
}
