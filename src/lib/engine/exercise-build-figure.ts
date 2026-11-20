import type { BuildContext, Built } from './exercise-context.ts';

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
	void ctx;
	throw new Error('not implemented');
}

/**
 * `occlusionDrag` (full weight): a `place` spec with the asked box's label and id. Figure:
 * every box covered, `target` null (the student must find the box). An image with only one
 * labelled box falls back to `occlusionType` (nothing to choose between).
 *
 * @see BUILD_PLAN §7.1; Decisions log "Phase 6 Q3"
 */
export function buildOcclusionDrag(ctx: BuildContext): Built {
	void ctx;
	throw new Error('not implemented');
}

/**
 * `occlusionType` (full weight): a `type` spec for the asked box's label, graded like every typed
 * answer (`gradeTyped`: accept list, `FUZZY_EDITS` by length, so short labels such as "IP" must be
 * exact; the collision guard checks the course's other answers). Figure as for the bank.
 *
 * @see BUILD_PLAN §7.1, §6.10
 */
export function buildOcclusionType(ctx: BuildContext): Built {
	void ctx;
	throw new Error('not implemented');
}

/**
 * `nodeCloze` (full weight): a `type` spec asking for a node's (or a stack layer's) label, from a
 * `node:<id>` or `layer:<id>` variant. Figure: the whole diagram with that node's label `null`
 * and `target` = its id; `layout` from `layoutDiagram` (null when too big);
 * `sourceMediaId` from the payload. A missing node falls back to `flip`.
 *
 * @see BUILD_PLAN §7.2
 */
export function buildNodeCloze(ctx: BuildContext): Built {
	void ctx;
	throw new Error('not implemented');
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
	void ctx;
	throw new Error('not implemented');
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
	void ctx;
	throw new Error('not implemented');
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
	void ctx;
	throw new Error('not implemented');
}
