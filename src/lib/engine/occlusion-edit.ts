import type { FractionBox } from './grading-shapes.ts';

/** A hide box as stored (DATA_MODEL §4.2 `occlusion`). */
export interface OcclusionBox extends FractionBox {
	id: string;
	label: string;
}

/** The parts of an occlusion payload the editor changes. */
export interface OcclusionBoxes {
	boxes: OcclusionBox[];
	unplaced?: string[];
}

/**
 * Keeps a box on the image: width and height at least `OCCLUSION_MIN_BOX` and at most 1, then
 * moved (not shrunk) so that 0 ≤ x, 0 ≤ y, x + w ≤ 1 and y + h ≤ 1.
 *
 * @see BUILD_PLAN §7.1 (boxes as fractions)
 */
export function clampBox<B extends FractionBox>(box: B): B {
	void box;
	throw new Error('not implemented');
}

/**
 * Adds a box with `newId()` and the trimmed label, clamped. An empty label is allowed (the
 * student names it next) but makes no card until named.
 *
 * @see BUILD_PLAN §7.1
 */
export function addBox(
	payload: OcclusionBoxes,
	rect: FractionBox,
	label: string,
	newId: () => string
): OcclusionBoxes {
	void payload;
	void rect;
	void label;
	void newId;
	throw new Error('not implemented');
}

/**
 * Places an `unplaced` label (the tap alternative to drawing a box): a box of
 * `OCCLUSION_NEW_BOX` size centred on `at` (fractions), clamped, with `newId()`; the label leaves
 * `unplaced` (its first occurrence only). Unknown labels change nothing.
 *
 * @see Decisions log "Phase 6 Q10–Q13" (`box:` lines → `unplaced`)
 */
export function placeLabel(
	payload: OcclusionBoxes,
	label: string,
	at: { x: number; y: number },
	newId: () => string
): OcclusionBoxes {
	void payload;
	void label;
	void at;
	void newId;
	throw new Error('not implemented');
}

/** Moves a box by (dx, dy) fractions, clamped onto the image. Unknown ids change nothing. */
export function moveBox(
	payload: OcclusionBoxes,
	boxId: string,
	dx: number,
	dy: number
): OcclusionBoxes {
	void payload;
	void boxId;
	void dx;
	void dy;
	throw new Error('not implemented');
}

/**
 * Resizes a box by (dw, dh) fractions, keeping its top-left corner, then clamped (never smaller
 * than `OCCLUSION_MIN_BOX`). Unknown ids change nothing.
 */
export function resizeBox(
	payload: OcclusionBoxes,
	boxId: string,
	dw: number,
	dh: number
): OcclusionBoxes {
	void payload;
	void boxId;
	void dw;
	void dh;
	throw new Error('not implemented');
}

/**
 * Removes a box. Other boxes keep their ids, so their cards keep their history; the removed
 * box's card is tombstoned by card regeneration (CLAUDE.md rule 7).
 */
export function removeBox(payload: OcclusionBoxes, boxId: string): OcclusionBoxes {
	void payload;
	void boxId;
	throw new Error('not implemented');
}
