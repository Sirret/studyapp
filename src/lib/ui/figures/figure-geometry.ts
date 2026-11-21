/**
 * Pure helpers for the figure components: where a box or node sits (as CSS percentages, so the
 * figure scales with its width), arrow lines, the screen-reader text of a diagram, and the drop
 * point of a dragged label.
 *
 * @see BUILD_PLAN §7; WIP step 8
 */
import type {
	DiagramFigure,
	DiagramKind,
	DiagramLayout,
	DiagramPreview,
	Figure,
	Point,
	RenderedSize
} from '#lib/services/figure-edit.ts';
import type { ExerciseSpec, MediaId } from '#lib/services/study-types.ts';

/** A node's box in layout units. */
export type LayoutBox = DiagramLayout['nodes'][string];

/** A rectangle as CSS percentages of its container. */
export interface PercentRect {
	left: string;
	top: string;
	width: string;
	height: string;
}

/** An arrow, from → to node ids. */
export interface Arrow {
	from: string;
	to: string;
}

const percent = (value: number): string => `${Math.round(value * 100_000) / 1000}%`;

/**
 * A rectangle as percentages of a `width` × `height` container (1 × 1 for occlusion boxes, which
 * are stored as fractions).
 */
export function percentRect(
	box: { x: number; y: number; w: number; h: number },
	size: RenderedSize = { width: 1, height: 1 }
): PercentRect {
	return {
		left: percent(box.x / size.width),
		top: percent(box.y / size.height),
		width: percent(box.w / size.width),
		height: percent(box.h / size.height)
	};
}

/**
 * A straight arrow between two node boxes: from the bottom centre of the source to the top centre
 * of the target when the target is lower, the other way round when it is higher, and side to side
 * when they share a row.
 */
export function connectorPoints(from: LayoutBox, to: LayoutBox): [Point, Point] {
	const centre = (b: LayoutBox): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
	const a = centre(from);
	const b = centre(to);
	if (to.y >= from.y + from.h)
		return [
			{ x: a.x, y: from.y + from.h },
			{ x: b.x, y: to.y }
		];
	if (to.y + to.h <= from.y)
		return [
			{ x: a.x, y: from.y },
			{ x: b.x, y: to.y + to.h }
		];
	return b.x >= a.x
		? [
				{ x: from.x + from.w, y: a.y },
				{ x: to.x, y: b.y }
			]
		: [
				{ x: from.x, y: a.y },
				{ x: to.x + to.w, y: b.y }
			];
}

/** An SVG `points` attribute. */
export function polylinePoints(points: readonly Point[]): string {
	return points.map((p) => `${p.x},${p.y}`).join(' ');
}

/** The text alternative of a diagram, one line per layer (top first) or per arrow. */
export function diagramLines(figure: DiagramFigure): string[] {
	const label = (value: string | null): string => value ?? 'hidden';
	if (figure.shape === 'stack') {
		return figure.nodes.map((n, i) => `Layer ${i + 1}: ${label(n.label)}`);
	}
	const names = new Map(figure.nodes.map((n) => [n.id, label(n.label)]));
	const arrows = figure.edges.map((e) => {
		const text = `${names.get(e.from) ?? ''} → ${names.get(e.to) ?? ''}`;
		return e.label === null ? text : `${text}: ${e.label}`;
	});
	const linked = new Set(figure.edges.flatMap((e) => [e.from, e.to]));
	const alone = figure.nodes.filter((n) => !linked.has(n.id)).map((n) => label(n.label));
	return [...arrows, ...alone];
}

/**
 * Where a pointer was released over an image, in rendered pixels with the rendered size (what
 * `checkPlace` grades); null when it was released outside the image.
 */
export function dropPoint(
	client: Point,
	rect: { left: number; top: number; width: number; height: number }
): { point: Point; size: RenderedSize } | null {
	const x = client.x - rect.left;
	const y = client.y - rect.top;
	if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
	return { point: { x, y }, size: { width: rect.width, height: rect.height } };
}

/** The figure a type, choose or order exercise shows above its question; null for none. */
export function staticFigure(spec: ExerciseSpec): Figure | null {
	switch (spec.shape) {
		case 'type':
		case 'choose':
		case 'order':
			return spec.figure ?? null;
		default:
			return null;
	}
}

/**
 * The connect exercise's tap: the first tap picks a source (`pending`), a second tap on the same
 * node cancels it, a tap on another node adds the arrow (once).
 */
export function tapNode(
	state: { pending: string | null; arrows: Arrow[] },
	nodeId: string
): { pending: string | null; arrows: Arrow[] } {
	const { pending, arrows } = state;
	if (pending === null) return { pending: nodeId, arrows };
	if (pending === nodeId) return { pending: null, arrows };
	const exists = arrows.some((a) => a.from === pending && a.to === nodeId);
	return { pending: null, arrows: exists ? arrows : [...arrows, { from: pending, to: nodeId }] };
}

/** The reference arrows the student did not draw (shown dashed after checking). */
export function missingArrows(drawn: readonly Arrow[], reference: readonly Arrow[]): Arrow[] {
	const key = (a: Arrow) => `${a.from}>${a.to}`;
	const have = new Set(drawn.map(key));
	return reference.filter((a) => !have.has(key(a)));
}

/** The editor's live preview as a figure (nothing hidden, nothing highlighted). */
export function previewFigure(
	kind: DiagramKind,
	title: string,
	preview: DiagramPreview
): DiagramFigure {
	return {
		kind: 'diagram',
		shape: kind,
		title,
		nodes: preview.nodes.map((n) => ({ id: n.id, label: n.label })),
		edges: preview.edges.map((e) => ({ id: e.id, from: e.from, to: e.to, label: e.label ?? null })),
		target: null,
		layout: preview.layout
	};
}

/**
 * How an occlusion box is drawn. `open` = not drawn (the image shows through); `editing` and
 * `active` (the selected one) are the editor's see-through outlines.
 */
export type BoxLook =
	| 'open'
	| 'covered'
	| 'target'
	| 'selected'
	| 'correct'
	| 'wrong'
	| 'revealed'
	| 'editing'
	| 'active';

/** A box as the figure draws it: where, how, the text inside it and its screen-reader name. */
export interface ShownBox {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
	look: BoxLook;
	text?: string;
	name: string;
}

/**
 * The boxes of a question's image: covered boxes covered, the asked one highlighted with "?" (or
 * with `reveal`, the answer, once checked), the rest open.
 */
export function occlusionBoxes(
	figure: { boxes: readonly FigureRect[]; covered: readonly string[]; target: string | null },
	reveal?: string
): ShownBox[] {
	return figure.boxes.map((b, i) => {
		const rect = { id: b.id, x: b.x, y: b.y, w: b.w, h: b.h };
		if (b.id === figure.target) {
			return reveal === undefined
				? { ...rect, look: 'target' as const, text: '?', name: 'The hidden part asked about' }
				: { ...rect, look: 'revealed' as const, text: reveal, name: reveal };
		}
		const covered = figure.covered.includes(b.id);
		return { ...rect, look: covered ? 'covered' : 'open', name: `Hidden part ${i + 1}` };
	});
}

type FigureRect = { id: string; x: number; y: number; w: number; h: number };

/** The picture a diagram question was made from, for "Show original"; null for none. */
export function originalOf(spec: ExerciseSpec): { mediaId: MediaId; title: string } | null {
	const figure = spec.shape === 'connect' ? spec.figure : staticFigure(spec);
	if (figure?.kind !== 'diagram' || !figure.sourceMediaId) return null;
	return { mediaId: figure.sourceMediaId, title: figure.title };
}
