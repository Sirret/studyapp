import { OCCLUSION_MIN_BOX, OCCLUSION_NEW_BOX } from '#lib/config/defaults.ts';
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
	const w = Math.min(Math.max(box.w, OCCLUSION_MIN_BOX), 1);
	const h = Math.min(Math.max(box.h, OCCLUSION_MIN_BOX), 1);
	const x = Math.min(Math.max(box.x, 0), 1 - w);
	const y = Math.min(Math.max(box.y, 0), 1 - h);
	return { ...box, x, y, w, h };
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
	const box = clampBox({
		id: newId(),
		x: rect.x,
		y: rect.y,
		w: rect.w,
		h: rect.h,
		label: label.trim()
	});
	return { ...payload, boxes: [...payload.boxes, box] };
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
	const unplaced = payload.unplaced ?? [];
	const index = unplaced.indexOf(label);
	if (index < 0) return payload;
	const { w, h } = OCCLUSION_NEW_BOX;
	const placed = addBox(payload, { x: at.x - w / 2, y: at.y - h / 2, w, h }, label, newId);
	return { ...placed, unplaced: [...unplaced.slice(0, index), ...unplaced.slice(index + 1)] };
}

/** Moves a box by (dx, dy) fractions, clamped onto the image. Unknown ids change nothing. */
export function moveBox(
	payload: OcclusionBoxes,
	boxId: string,
	dx: number,
	dy: number
): OcclusionBoxes {
	return updateBox(payload, boxId, (b) => ({ ...b, x: b.x + dx, y: b.y + dy }));
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
	return updateBox(payload, boxId, (b) => ({ ...b, w: b.w + dw, h: b.h + dh }));
}

/**
 * Removes a box. Other boxes keep their ids, so their cards keep their history; the removed
 * box's card is tombstoned by card regeneration (CLAUDE.md rule 7).
 */
export function removeBox(payload: OcclusionBoxes, boxId: string): OcclusionBoxes {
	if (!payload.boxes.some((b) => b.id === boxId)) return payload;
	return { ...payload, boxes: payload.boxes.filter((b) => b.id !== boxId) };
}

/** Replaces one box by `change(box)`, clamped; an unknown id returns the payload unchanged. */
function updateBox(
	payload: OcclusionBoxes,
	boxId: string,
	change: (box: OcclusionBox) => OcclusionBox
): OcclusionBoxes {
	if (!payload.boxes.some((b) => b.id === boxId)) return payload;
	return {
		...payload,
		boxes: payload.boxes.map((b) => (b.id === boxId ? clampBox(change(b)) : b))
	};
}
