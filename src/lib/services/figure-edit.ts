/**
 * The pure parts of the figure editors, for the UI (which may not import the engine or the
 * import grammar): the occlusion box helpers, the diagram preview, and the figure types. Nothing
 * here touches the database, so the style guide can use it too; the saving services live in
 * `figure-wiring.ts`.
 *
 * @see BUILD_PLAN §7, §15.1 (import direction)
 */
import type { DiagramStructure } from '#lib/engine/diagram-edit.ts';
import { mergeDiagram } from '#lib/engine/diagram-edit.ts';
import { layoutDiagram, type DiagramLayout } from '#lib/engine/diagram-layout.ts';
import { parseDiagramText, type DiagramTextError } from '#lib/import/diagram-parser.ts';

export {
	addBox,
	clampBox,
	moveBox,
	placeLabel,
	removeBox,
	resizeBox,
	type OcclusionBox,
	type OcclusionBoxes
} from '#lib/engine/occlusion-edit.ts';
export type {
	ConnectSpec,
	DiagramFigure,
	Figure,
	FigureBox,
	OcclusionFigure,
	PlaceSpec
} from '#lib/engine/exercise-spec.ts';
export type { Point, RenderedSize } from '#lib/engine/grading-shapes.ts';
export type { DiagramLayout, DiagramTextError };

/** A diagram's kind: a stack of layers or a flow of arrows. */
export type DiagramKind = DiagramStructure['kind'];

/** The diagram as the editor draws it: structure and layout (null = too big to draw). */
export interface DiagramPreview {
	errors: DiagramTextError[];
	nodes: { id: string; label: string; role?: string }[];
	edges: { id: string; from: string; to: string; label?: string }[];
	layout: DiagramLayout | null;
}

/**
 * What `text` would draw, writing nothing. Preview IDs are throwaway (`p1`, `p2`…), so the same
 * text always previews the same way.
 *
 * @see BUILD_PLAN §7.2; Decisions log "Phase 6 Q4"
 */
export function previewDiagram(kind: DiagramKind, text: string): DiagramPreview {
	const { parsed, errors } = parseDiagramText(kind, text);
	if (!parsed) return { errors, nodes: [], edges: [], layout: null };
	let next = 0;
	const { result } = mergeDiagram(null, parsed, '', () => `p${(next += 1)}`);
	return { errors, nodes: result.nodes, edges: result.edges, layout: layoutDiagram(result).result };
}
