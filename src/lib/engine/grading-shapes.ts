import type { Traced } from './trace.ts';

/** A point in rendered pixels. */
export interface Point {
	x: number;
	y: number;
}

/** A box in fractions [0, 1] of the image. @see DATA_MODEL §4.2 (occlusion) */
export interface FractionBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** The rendered image size in pixels. */
export interface RenderedSize {
	width: number;
	height: number;
}

/** Sequence verdict: `misplaced` lists step indexes outside the kept LIS, ascending. */
export interface SequenceVerdict {
	correct: boolean;
	misplaced: number[];
}

/** One directed edge in a diagram rebuild. */
export interface EdgeTriple {
	from: string;
	to: string;
	label?: string;
}

/** Rebuild verdict; `missing` and `extra` are sorted by from, to, normalised label. */
export interface EdgeSetVerdict {
	correct: boolean;
	missing: EdgeTriple[];
	extra: EdgeTriple[];
}

/**
 * True when the drop point is inside the box (edges included), scaled to the rendered size.
 *
 * @see BUILD_PLAN §6.10 (hit test)
 */
export function hitTest(_point: Point, _box: FractionBox, _size: RenderedSize): boolean {
	throw new Error('not implemented');
}

/**
 * Grades an order given as the original step indexes in the student's order.
 * Throws if `order` isn't a permutation of 0…n−1.
 *
 * @see BUILD_PLAN §6.10 (sequences) and Decisions log (LIS ties)
 */
export function gradeSequence(_order: readonly number[]): Traced<SequenceVerdict> {
	throw new Error('not implemented');
}

/**
 * Compares the student's edge set with the reference.
 *
 * @see BUILD_PLAN §6.10 (diagram rebuild) and Decisions log
 */
export function gradeEdgeSet(
	_student: readonly EdgeTriple[],
	_reference: readonly EdgeTriple[]
): Traced<EdgeSetVerdict> {
	throw new Error('not implemented');
}
