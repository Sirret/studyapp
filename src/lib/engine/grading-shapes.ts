import { normalizeAnswer } from './grading.ts';
import { compareText } from './replay.ts';
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
export function hitTest(point: Point, box: FractionBox, size: RenderedSize): boolean {
	const left = box.x * size.width;
	const top = box.y * size.height;
	const right = left + box.w * size.width;
	const bottom = top + box.h * size.height;
	return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
}

function assertPermutation(order: readonly number[]): void {
	const seen = new Set<number>();
	for (const value of order) {
		const valid = Number.isInteger(value) && value >= 0 && value < order.length;
		if (!valid || seen.has(value)) throw new Error(`Not a permutation of 0…${order.length - 1}`);
		seen.add(value);
	}
}

/** For each position, the length of the longest increasing subsequence starting there. */
function lisFrom(order: readonly number[]): number[] {
	const lengths = order.map(() => 1);
	for (let i = order.length - 2; i >= 0; i -= 1) {
		for (let j = i + 1; j < order.length; j += 1) {
			if ((order[j] as number) > (order[i] as number)) {
				lengths[i] = Math.max(lengths[i] as number, (lengths[j] as number) + 1);
			}
		}
	}
	return lengths;
}

/** The steps in the longest increasing subsequence with the earliest positions. */
function keptSteps(order: readonly number[]): Set<number> {
	const lengths = lisFrom(order);
	const kept = new Set<number>();
	let need = Math.max(0, ...lengths);
	let last = -1;
	for (let i = 0; i < order.length && need > 0; i += 1) {
		const value = order[i] as number;
		if (value > last && lengths[i] === need) {
			kept.add(value);
			last = value;
			need -= 1;
		}
	}
	return kept;
}

/**
 * Grades an order given as the original step indexes in the student's order.
 * Throws if `order` isn't a permutation of 0…n−1.
 *
 * @see BUILD_PLAN §6.10 (sequences) and Decisions log (LIS ties)
 */
export function gradeSequence(order: readonly number[]): Traced<SequenceVerdict> {
	assertPermutation(order);
	const kept = keptSteps(order);
	const misplaced = order.filter((step) => !kept.has(step)).sort((a, b) => a - b);
	const result = { correct: misplaced.length === 0, misplaced };
	return { result, trace: [{ rule: 'sequence-lis', kept: kept.size, misplaced }] };
}

const edgeKey = (edge: EdgeTriple): string =>
	JSON.stringify([edge.from, edge.to, normalizeAnswer(edge.label ?? '')]);

/** Edges by key, keeping the first of each duplicate. */
function edgeMap(edges: readonly EdgeTriple[]): Map<string, EdgeTriple> {
	const map = new Map<string, EdgeTriple>();
	for (const edge of edges) if (!map.has(edgeKey(edge))) map.set(edgeKey(edge), edge);
	return map;
}

function compareEdges(a: EdgeTriple, b: EdgeTriple): number {
	return (
		compareText(a.from, b.from) ||
		compareText(a.to, b.to) ||
		compareText(normalizeAnswer(a.label ?? ''), normalizeAnswer(b.label ?? ''))
	);
}

/** Edges in `from` whose key isn't in `other`, sorted. */
function edgesNotIn(from: Map<string, EdgeTriple>, other: Map<string, EdgeTriple>): EdgeTriple[] {
	return [...from]
		.filter(([key]) => !other.has(key))
		.map(([, edge]) => edge)
		.sort(compareEdges);
}

/**
 * Compares the student's edge set with the reference.
 *
 * @see BUILD_PLAN §6.10 (diagram rebuild) and Decisions log
 */
export function gradeEdgeSet(
	student: readonly EdgeTriple[],
	reference: readonly EdgeTriple[]
): Traced<EdgeSetVerdict> {
	const given = edgeMap(student);
	const expected = edgeMap(reference);
	const missing = edgesNotIn(expected, given);
	const extra = edgesNotIn(given, expected);
	const result = { correct: missing.length === 0 && extra.length === 0, missing, extra };
	return { result, trace: [{ rule: 'edge-set', missing: missing.length, extra: extra.length }] };
}
