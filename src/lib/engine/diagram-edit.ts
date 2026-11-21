import type { Result } from '#lib/util/result.ts';
import { normalizeAnswer } from './grading.ts';
import type { TraceEntry, Traced } from './trace.ts';

type DiagramNode = DiagramStructure['nodes'][number];
type DiagramEdge = DiagramStructure['edges'][number];

/**
 * The key two node labels are the same node by: `normalizeAnswer` with spaces removed, so
 * "Data base" and "database" are one node (Decisions log "Phase 6 step 4").
 */
export function nodeKey(label: string): string {
	return normalizeAnswer(label).replaceAll(' ', '');
}

/** A diagram as stored in a note payload (DATA_MODEL §4.2). */
export interface DiagramStructure {
	kind: 'stack' | 'flow';
	name: string;
	nodes: { id: string; label: string; role?: string }[];
	edges: { id: string; from: string; to: string; label?: string }[];
	layout?: Record<string, { x: number; y: number }>;
	sourceMediaId?: string;
}

/**
 * A diagram as the text grammar gives it, before IDs: a stack's layers top to bottom
 * (`label` or `label :: role`), or a flow's arrows (`A -> B` or `A -> B : label`).
 *
 * @see BUILD_PLAN §4.1 (`@diagram`)
 */
export type ParsedDiagram =
	| { kind: 'stack'; layers: { label: string; role?: string }[] }
	| { kind: 'flow'; edges: { from: string; to: string; label?: string }[] };

/**
 * Builds the diagram a text edit describes, keeping IDs so review history stays on the right
 * cards (CLAUDE.md rule 7; card variants are `layer:<id>`, `node:<id>`, `edge:<id>`):
 *
 * - A node keeps its ID when a node of the previous diagram has the same label after
 *   normalising (case, spacing; `normalizeAnswer`). New labels get `newId()`; nodes no longer
 *   mentioned are dropped.
 * - A flow arrow keeps its ID when the previous diagram had an arrow between the same two
 *   (kept) nodes in the same direction; its label may change. If several previous arrows join
 *   the same pair, they are matched in their previous order.
 * - Line order never changes an ID; only a stack's layer order is taken from the text.
 * - `name`, `layout` and `sourceMediaId` are kept from `previous`; with no previous diagram
 *   every ID is new and `name` is the given one.
 * - A flow's nodes are listed in first-mention order. A stack has no edges.
 *
 * Renaming a node in the text is a delete plus an add (its cards start fresh); `renameNode`
 * keeps the ID.
 *
 * @see BUILD_PLAN §7.2 ("keeping card IDs for unchanged nodes/edges"); Decisions log "Phase 6 Q5"
 */
export function mergeDiagram(
	previous: DiagramStructure | null,
	parsed: ParsedDiagram,
	name: string,
	newId: () => string
): Traced<DiagramStructure> {
	const trace: TraceEntry[] = [];
	const oldIds = new Map((previous?.nodes ?? []).map((n) => [nodeKey(n.label), n.id]));
	const nodes = new Map<string, DiagramNode>();
	const nodeFor = (label: string, role?: string): DiagramNode => {
		const key = nodeKey(label);
		const known = nodes.get(key);
		if (known) return known;
		const kept = oldIds.get(key);
		const node = { id: kept ?? newId(), label: label.trim(), ...(role ? { role } : {}) };
		trace.push({
			rule: kept ? 'diagram.node.kept' : 'diagram.node.new',
			label: node.label,
			id: node.id
		});
		nodes.set(key, node);
		return node;
	};
	let edges: DiagramEdge[] = [];
	if (parsed.kind === 'stack') {
		for (const layer of parsed.layers) nodeFor(layer.label, layer.role);
	} else {
		const arrows = parsed.edges.map((e) => ({
			from: nodeFor(e.from).id,
			to: nodeFor(e.to).id,
			label: e.label
		}));
		edges = matchEdges(previous?.edges ?? [], arrows, newId, trace);
	}
	const kept = previous
		? {
				name: previous.name,
				...(previous.layout ? { layout: previous.layout } : {}),
				...(previous.sourceMediaId ? { sourceMediaId: previous.sourceMediaId } : {})
			}
		: { name };
	return { result: { kind: parsed.kind, ...kept, nodes: [...nodes.values()], edges }, trace };
}

/** Gives each arrow the ID of the first unused previous arrow with the same (from, to). */
function matchEdges(
	previous: readonly DiagramEdge[],
	arrows: readonly { from: string; to: string; label?: string | undefined }[],
	newId: () => string,
	trace: TraceEntry[]
): DiagramEdge[] {
	const used = new Set<string>();
	return arrows.map((arrow) => {
		const match = previous.find(
			(e) => !used.has(e.id) && e.from === arrow.from && e.to === arrow.to
		);
		if (match) used.add(match.id);
		const id = match?.id ?? newId();
		trace.push({
			rule: match ? 'diagram.edge.kept' : 'diagram.edge.new',
			id,
			from: arrow.from,
			to: arrow.to
		});
		return { id, from: arrow.from, to: arrow.to, ...(arrow.label ? { label: arrow.label } : {}) };
	});
}

/**
 * Renames one node, keeping its ID (and so its cards and their history). Errors when the node
 * doesn't exist, the new label is empty after trimming, or another node already has that label
 * after normalising.
 *
 * @see BUILD_PLAN §7.2; Decisions log "Phase 6 Q5"
 */
export function renameNode(
	diagram: DiagramStructure,
	nodeId: string,
	label: string
): Result<DiagramStructure, string> {
	const node = diagram.nodes.find((n) => n.id === nodeId);
	if (!node) return { ok: false, error: 'That node is not in this diagram.' };
	const trimmed = label.trim();
	if (trimmed === '') return { ok: false, error: 'A node needs a name.' };
	const key = nodeKey(trimmed);
	if (diagram.nodes.some((n) => n.id !== nodeId && nodeKey(n.label) === key)) {
		return { ok: false, error: `Another node is already called "${trimmed}".` };
	}
	const nodes = diagram.nodes.map((n) => (n.id === nodeId ? { ...n, label: trimmed } : n));
	return { ok: true, value: { ...diagram, nodes } };
}
