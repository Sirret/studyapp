/**
 * Pointer gestures of the occlusion editor, as pure functions: where a pointer is on the image
 * (fractions), and what a finished drag does — draw a box, or (a tap) place a default-size box.
 * Moving and resizing reuse the box helpers from `figure-edit.ts`.
 *
 * @see BUILD_PLAN §7.1; WIP step 8
 */
import { OCCLUSION_MIN_BOX, OCCLUSION_NEW_BOX } from '#lib/config/defaults.ts';
import type { Point } from '#lib/services/figure-edit.ts';

/** A rectangle in fractions of the image. */
export interface FractionRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** What a pointer gesture on the editor's image is doing. */
export type Gesture =
	| { kind: 'draw'; start: Point; now: Point }
	| { kind: 'move'; boxId: string; start: Point; now: Point }
	| { kind: 'resize'; boxId: string; start: Point; now: Point };

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

/** A pointer position as fractions of the image box, kept inside [0, 1]. */
export function fractionAt(
	client: Point,
	rect: { left: number; top: number; width: number; height: number }
): Point {
	if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
	return {
		x: clamp01((client.x - rect.left) / rect.width),
		y: clamp01((client.y - rect.top) / rect.height)
	};
}

/** The rectangle spanned by two corners, whichever way it was dragged. */
export function rectBetween(a: Point, b: Point): FractionRect {
	return {
		x: Math.min(a.x, b.x),
		y: Math.min(a.y, b.y),
		w: Math.abs(a.x - b.x),
		h: Math.abs(a.y - b.y)
	};
}

/** The pointer travel of a gesture, in fractions. */
export function delta(gesture: Gesture): Point {
	return { x: gesture.now.x - gesture.start.x, y: gesture.now.y - gesture.start.y };
}

/**
 * The box a finished draw gesture adds: the dragged rectangle when it is at least
 * `OCCLUSION_MIN_BOX` both ways; otherwise it was a tap, which places an `OCCLUSION_NEW_BOX`
 * centred on the point (the tap alternative to drawing, CLAUDE.md rule 10).
 */
export function drawnRect(start: Point, end: Point): FractionRect {
	const rect = rectBetween(start, end);
	if (rect.w >= OCCLUSION_MIN_BOX && rect.h >= OCCLUSION_MIN_BOX) return rect;
	const { w, h } = OCCLUSION_NEW_BOX;
	return { x: end.x - w / 2, y: end.y - h / 2, w, h };
}
