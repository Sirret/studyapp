import { DIAGRAM_LAYOUT_SWEEPS } from '#lib/config/defaults.ts';

/** An arrow as node indexes into the layout's `nodes` array. */
export interface IndexedArrow {
	from: number;
	to: number;
}

/**
 * The arrows that layering uses: self-loops and arrows that close a cycle are dropped. The cycle
 * test is a depth-first search started from every source in `nodes` order, then from any node not
 * yet reached (in `nodes` order), visiting targets in `nodes` order, so the result never depends
 * on the order arrows are listed in.
 *
 * @see BUILD_PLAN §7.2; Decisions log "Phase 6 Q4"
 */
export function acyclicArrows(count: number, arrows: readonly IndexedArrow[]): IndexedArrow[] {
	const targets = Array.from({ length: count }, () => new Set<number>());
	for (const a of arrows) if (a.from !== a.to) targets[a.from]?.add(a.to);
	const sorted = targets.map((set) => [...set].sort((p, q) => p - q));
	const hasIncoming = new Set(arrows.filter((a) => a.from !== a.to).map((a) => a.to));
	const state = new Array<'new' | 'open' | 'done'>(count).fill('new');
	const kept: IndexedArrow[] = [];
	const visit = (node: number): void => {
		state[node] = 'open';
		for (const next of sorted[node] ?? []) {
			if (state[next] === 'open') continue;
			kept.push({ from: node, to: next });
			if (state[next] === 'new') visit(next);
		}
		state[node] = 'done';
	};
	const order = Array.from({ length: count }, (_x, i) => i);
	for (const node of [...order.filter((i) => !hasIncoming.has(i)), ...order]) {
		if (state[node] === 'new') visit(node);
	}
	return kept;
}

/** Each node's layer: its longest path from a source over the acyclic arrows. */
export function longestPathLayers(count: number, arrows: readonly IndexedArrow[]): number[] {
	const layer = new Array<number>(count).fill(0);
	// Relaxing `count` times settles every longest path of an acyclic graph.
	for (let round = 0; round < count; round += 1) {
		let changed = false;
		for (const a of arrows) {
			const candidate = (layer[a.from] ?? 0) + 1;
			if (candidate > (layer[a.to] ?? 0)) {
				layer[a.to] = candidate;
				changed = true;
			}
		}
		if (!changed) break;
	}
	return layer;
}

/** The mean position of `neighbours` in `position`, or `fallback` when there are none. */
function barycentre(
	neighbours: readonly number[],
	position: readonly number[],
	fallback: number
): number {
	if (neighbours.length === 0) return fallback;
	return neighbours.reduce((sum, n) => sum + (position[n] ?? 0), 0) / neighbours.length;
}

/**
 * Orders the nodes of each layer to reduce crossings: `DIAGRAM_LAYOUT_SWEEPS` down-and-up passes,
 * each node sorted by the barycentre of its neighbours' positions in the layers above (down) or
 * below (up). Ties keep the current order, which starts as `nodes` order.
 */
export function orderLayers(
	layerOf: readonly number[],
	arrows: readonly IndexedArrow[]
): number[][] {
	const depth = Math.max(-1, ...layerOf) + 1;
	const layers: number[][] = Array.from({ length: depth }, () => []);
	layerOf.forEach((l, node) => layers[l]?.push(node));
	const position: number[] = [];
	const place = (layer: number[]) => layer.forEach((node, i) => (position[node] = i));
	layers.forEach(place);
	const up = layerOf.map((_l, node) => arrows.filter((a) => a.to === node).map((a) => a.from));
	const down = layerOf.map((_l, node) => arrows.filter((a) => a.from === node).map((a) => a.to));
	const sortLayer = (index: number, neighbours: number[][]) => {
		const layer = layers[index] ?? [];
		const keyed = layer.map((node, i) => ({
			node,
			i,
			key: barycentre(neighbours[node] ?? [], position, i)
		}));
		keyed.sort((p, q) => p.key - q.key || p.i - q.i);
		layers[index] = keyed.map((k) => k.node);
		place(layers[index]);
	};
	for (let sweep = 0; sweep < DIAGRAM_LAYOUT_SWEEPS; sweep += 1) {
		for (let i = 1; i < depth; i += 1) sortLayer(i, up);
		for (let i = depth - 2; i >= 0; i -= 1) sortLayer(i, down);
	}
	return layers;
}
