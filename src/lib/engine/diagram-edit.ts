import type { Result } from '#lib/util/result.ts';
import type { Traced } from './trace.ts';

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
	void previous;
	void parsed;
	void name;
	void newId;
	throw new Error('not implemented');
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
	void diagram;
	void nodeId;
	void label;
	throw new Error('not implemented');
}
