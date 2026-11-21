import { MC_OPTIONS, OCCLUSION_BANK_MIN_OPTIONS } from '#lib/config/defaults.ts';
import { layoutDiagram } from './diagram-layout.ts';
import { buildTyped } from './exercise-build-text.ts';
import { baseOf, fallback, shuffled, type BuildContext, type Built } from './exercise-context.ts';
import type {
	DiagramFigure,
	ExerciseNote,
	OcclusionFigure,
	SpecOption,
	TypeSpec
} from './exercise-types.ts';
import { normalizeAnswer } from './grading.ts';
import { shuffle } from './rng.ts';

/*
 * Builders for the image and diagram kinds (BUILD_PLAN §5.1, §7). Each returns a spec whose
 * `figure` the screen draws, or falls back (`fallback(kind, reason)`) when the card's note can't
 * support the kind. All shuffles use `ctx.rng` (`rngFor(cardId, sessionId, attempt)`), so the same
 * card, session and attempt always give the same spec. Box and node labels other than those the
 * question shows are never put in a spec.
 *
 * Occlusion figures (all three kinds): `title` = the payload's `title`, else "Image"; `boxes` =
 * every box with a non-empty label, in payload order, without labels. The asked box is the
 * card's `box:<id>` variant; a variant whose box is gone or has an empty label falls back to
 * `flip`.
 */

type OcclusionNote = Extract<ExerciseNote, { type: 'occlusion' }>;
type DiagramNote = Extract<ExerciseNote, { type: 'diagram' }>;
type Box = OcclusionNote['payload']['boxes'][number];

/** The id after `prefix:` in a variant, else null. */
function variantId(variant: string, prefix: string): string | null {
	return variant.startsWith(`${prefix}:`) ? variant.slice(prefix.length + 1) : null;
}

/** The note's labelled boxes and the asked one, or why the card can't be shown on the image. */
function occlusionParts(
	ctx: BuildContext
): { note: OcclusionNote; labelled: Box[]; asked: Box } | { reason: string } {
	if (ctx.note.type !== 'occlusion') return { reason: 'not an image note' };
	const id = variantId(ctx.input.card.variant, 'box');
	const labelled = ctx.note.payload.boxes.filter((box) => box.label.trim() !== '');
	const asked = labelled.find((box) => box.id === id);
	return asked ? { note: ctx.note, labelled, asked } : { reason: 'the box is gone or unnamed' };
}

/** The image with its labelled boxes; `covered` and `target` as each kind needs. */
function occlusionFigure(
	note: OcclusionNote,
	labelled: readonly Box[],
	covered: string[],
	target: string | null
): OcclusionFigure {
	return {
		kind: 'occlusion',
		mediaId: note.payload.mediaId,
		title: note.payload.title ?? 'Image',
		boxes: labelled.map(({ id, x, y, w, h }) => ({ id, x, y, w, h })),
		covered,
		target
	};
}

/** Covered boxes for the bank and typed kinds: the asked one in hide-one mode, all in hide-all. */
function hideCovered(note: OcclusionNote, labelled: readonly Box[], asked: Box): string[] {
	return note.payload.hide === 'all' ? labelled.map((box) => box.id) : [asked.id];
}

/** The asked label plus up to `MC_OPTIONS - 1` other distinct labels of the same image. */
function bankLabels(ctx: BuildContext, labelled: readonly Box[], asked: Box): Box[] {
	const seen = new Set([normalizeAnswer(asked.label)]);
	const siblings = labelled.filter((box) => {
		const key = normalizeAnswer(box.label);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
	return [asked, ...shuffle(siblings, ctx.rng).slice(0, MC_OPTIONS - 1)];
}

/** A bank option; a sibling's names the card it answers, for confusion logging. */
function bankOption(ctx: BuildContext, box: Box): SpecOption {
	const variant = `box:${box.id}`;
	const card = ctx.input.course.cards.find(
		(c) => c.noteId === ctx.note.id && c.variant === variant
	);
	return card && card.id !== ctx.input.card.id
		? { text: box.label, cardId: card.id }
		: { text: box.label };
}

/**
 * `occlusionBank` (recognition): a `choose` spec. Options are the asked box's label plus the
 * labels of the same image's other boxes (never other notes' answers; distinct after
 * normalising), shuffled, at most `MC_OPTIONS`. With fewer than `OCCLUSION_BANK_MIN_OPTIONS`
 * options it falls back to `occlusionType`. Figure: `covered` = the asked box only in hide-one
 * mode (`hide` absent or `one`), every box in hide-all mode; `target` = the asked box.
 *
 * @see BUILD_PLAN §7.1; Decisions log "Phase 6 Q3"
 */
export function buildOcclusionBank(ctx: BuildContext): Built {
	const parts = occlusionParts(ctx);
	if ('reason' in parts) return fallback('flip', parts.reason);
	const { note, labelled, asked } = parts;
	const boxes = bankLabels(ctx, labelled, asked);
	if (boxes.length < OCCLUSION_BANK_MIN_OPTIONS) {
		return fallback(
			'occlusionType',
			`fewer than ${OCCLUSION_BANK_MIN_OPTIONS} labels on the image`
		);
	}
	const order = shuffled(
		boxes.map((box) => box.id),
		ctx.rng
	);
	const byId = new Map(boxes.map((box) => [box.id, box]));
	return {
		...baseOf(ctx, 'occlusionBank'),
		shape: 'choose',
		options: order.items.map((id) => bankOption(ctx, byId.get(id) as Box)),
		correctIndex: order.at[0] ?? 0,
		letter: null,
		figure: occlusionFigure(note, labelled, hideCovered(note, labelled, asked), asked.id)
	};
}

/**
 * `occlusionDrag` (full weight): a `place` spec with the asked box's label and id. Figure:
 * every box covered, `target` null (the student must find the box). An image with only one
 * labelled box falls back to `occlusionType` (nothing to choose between).
 *
 * @see BUILD_PLAN §7.1; Decisions log "Phase 6 Q3"
 */
export function buildOcclusionDrag(ctx: BuildContext): Built {
	const parts = occlusionParts(ctx);
	if ('reason' in parts) return fallback('flip', parts.reason);
	const { note, labelled, asked } = parts;
	if (labelled.length < 2) return fallback('occlusionType', 'only one labelled box');
	const covered = labelled.map((box) => box.id);
	return {
		...baseOf(ctx, 'occlusionDrag'),
		shape: 'place',
		figure: occlusionFigure(note, labelled, covered, null),
		label: asked.label,
		boxId: asked.id
	};
}

/** `buildTyped` for a figure kind, with the figure attached. */
function typedWith(ctx: BuildContext, kind: TypeSpec['kind'], figure: TypeSpec['figure']): Built {
	const built = buildTyped(ctx, kind);
	if ('fallback' in built || built.shape !== 'type') return built;
	return { ...built, ...(figure ? { figure } : {}) };
}

/**
 * `occlusionType` (full weight): a `type` spec for the asked box's label, graded like every typed
 * answer (`gradeTyped`: accept list, `FUZZY_EDITS` by length, so short labels such as "IP" must be
 * exact; the collision guard checks the course's other answers). Figure as for the bank.
 *
 * @see BUILD_PLAN §7.1, §6.10
 */
export function buildOcclusionType(ctx: BuildContext): Built {
	const parts = occlusionParts(ctx);
	if ('reason' in parts) return fallback('flip', parts.reason);
	const { note, labelled, asked } = parts;
	const covered = hideCovered(note, labelled, asked);
	return typedWith(ctx, 'occlusionType', occlusionFigure(note, labelled, covered, asked.id));
}

/** The whole diagram as a figure, with the given node and arrow labels hidden. */
function diagramFigure(
	note: DiagramNote,
	hidden: { nodes: ReadonlySet<string>; edges: ReadonlySet<string> },
	target: string | null
): DiagramFigure {
	const { payload } = note;
	return {
		kind: 'diagram',
		shape: payload.kind,
		title: payload.name,
		nodes: payload.nodes.map((n) => ({
			id: n.id,
			label: hidden.nodes.has(n.id) ? null : n.label,
			...(n.role ? { role: n.role } : {})
		})),
		edges: payload.edges.map((e) => ({
			id: e.id,
			from: e.from,
			to: e.to,
			label: hidden.edges.has(e.id) ? null : (e.label ?? null)
		})),
		target,
		layout: layoutDiagram(payload).result,
		...(payload.sourceMediaId ? { sourceMediaId: payload.sourceMediaId } : {})
	};
}

const NONE: ReadonlySet<string> = new Set();

/**
 * `nodeCloze` (full weight): a `type` spec asking for a node's (or a stack layer's) label, from a
 * `node:<id>` or `layer:<id>` variant. Figure: the whole diagram with that node's label `null`
 * and `target` = its id; `layout` from `layoutDiagram` (null when too big);
 * `sourceMediaId` from the payload. A missing node falls back to `flip`.
 *
 * @see BUILD_PLAN §7.2
 */
export function buildNodeCloze(ctx: BuildContext): Built {
	if (ctx.note.type !== 'diagram') return fallback('flip', 'not a diagram note');
	const { variant } = ctx.input.card;
	const id = variantId(variant, 'node') ?? variantId(variant, 'layer');
	if (!ctx.note.payload.nodes.some((n) => n.id === id) || id === null) {
		return fallback('flip', 'the node is gone');
	}
	const figure = diagramFigure(ctx.note, { nodes: new Set([id]), edges: NONE }, id);
	return typedWith(ctx, 'nodeCloze', figure);
}

/**
 * `edgeCloze` (full weight): a `type` spec for an arrow (`edge:<id>`). The answer is the arrow's
 * label; for an arrow without a label it is the target node's label (that node's label is then
 * hidden too). Figure: the whole diagram with the asked label `null` and `target` = the edge id.
 * A missing edge falls back to `flip`.
 *
 * @see BUILD_PLAN §7.2; `answers.ts` (edge answer)
 */
export function buildEdgeCloze(ctx: BuildContext): Built {
	if (ctx.note.type !== 'diagram') return fallback('flip', 'not a diagram note');
	const id = variantId(ctx.input.card.variant, 'edge');
	const edge = ctx.note.payload.edges.find((e) => e.id === id);
	if (!edge) return fallback('flip', 'the arrow is gone');
	const nodes = edge.label === undefined ? new Set([edge.to]) : NONE;
	const figure = diagramFigure(ctx.note, { nodes, edges: new Set([edge.id]) }, edge.id);
	return typedWith(ctx, 'edgeCloze', figure);
}

/**
 * `structureRebuild` (full weight): a `connect` spec for a flow's `rebuild` card. Figure: every
 * node with its label, no arrows, `target` null, `layout` of the full diagram (so nodes sit where
 * they will be). `edges` = the reference arrows (from, to). A flow with no arrows, or a stack,
 * falls back to `flip`.
 *
 * @see BUILD_PLAN §7.2; Decisions log "Phase 6 Q8"
 */
export function buildStructureRebuild(ctx: BuildContext): Built {
	if (ctx.note.type !== 'diagram' || ctx.note.payload.kind !== 'flow') {
		return fallback('flip', 'rebuild needs a flow diagram');
	}
	if (ctx.note.payload.edges.length === 0) return fallback('flip', 'the flow has no arrows');
	const full = diagramFigure(ctx.note, { nodes: NONE, edges: NONE }, null);
	return {
		...baseOf(ctx, 'structureRebuild'),
		shape: 'connect',
		figure: { ...full, edges: [] },
		edges: ctx.note.payload.edges.map((e) => ({ from: e.from, to: e.to }))
	};
}

/** A seeded order of `count` items that is never the identity when `count` ≥ 2. */
function notInOrder(count: number, ctx: BuildContext): number[] {
	const order = shuffle(
		Array.from({ length: count }, (_x, i) => i),
		ctx.rng
	);
	const identity = order.every((item, i) => item === i);
	return identity && count >= 2 ? [...order.slice(1), order[0] as number] : order;
}

/**
 * `layerOrder` (full weight): an `order` spec for a stack's `layers` card. Items = the layer
 * labels shuffled (never in the right order when there are at least two distinct layers);
 * `correctOrder` = top to bottom; no extras. Figure: the stack with every label `null`. A diagram
 * that is not a stack, or has fewer than two layers, falls back to `flip`.
 *
 * @see BUILD_PLAN §7.2
 */
export function buildLayerOrder(ctx: BuildContext): Built {
	if (ctx.note.type !== 'diagram' || ctx.note.payload.kind !== 'stack') {
		return fallback('flip', 'layer order needs a stack');
	}
	const { nodes } = ctx.note.payload;
	if (nodes.length < 2) return fallback('flip', 'fewer than two layers');
	const order = notInOrder(nodes.length, ctx);
	const at: number[] = [];
	order.forEach((original, position) => (at[original] = position));
	const hidden = { nodes: new Set(nodes.map((n) => n.id)), edges: NONE };
	return {
		...baseOf(ctx, 'layerOrder'),
		shape: 'order',
		items: order.map((i) => nodes[i]?.label ?? ''),
		correctOrder: nodes.map((_n, i) => at[i] ?? 0),
		extras: [],
		figure: diagramFigure(ctx.note, hidden, null)
	};
}
