import type { ExerciseResponse, ExerciseVerdict } from './exercise-check.ts';
import type { ConnectSpec, PlaceSpec } from './exercise-types.ts';
import { gradeEdgeSet, hitTest } from './grading-shapes.ts';

/**
 * Grades `occlusionDrag`. A drop point (rendered pixels, with the rendered image size) is right
 * when `hitTest` puts it inside the asked box (edges included); a tapped box is right when it is
 * the asked box. A point inside several boxes counts as the asked one if it is inside it.
 * `reveal` = the label; `chosen` = the tapped or hit box's id (none for a miss); `marks` empty.
 *
 * @see BUILD_PLAN §7.1, §6.10 (hit test)
 */
export function checkPlace(
	spec: PlaceSpec,
	response: Extract<ExerciseResponse, { shape: 'place' }>
): ExerciseVerdict {
	const { at } = response;
	const boxes = spec.figure.boxes;
	const chosen =
		'boxId' in at
			? at.boxId
			: (
					boxes.find((b) => b.id === spec.boxId && hitTest(at.point, b, at.size)) ??
					boxes.find((b) => hitTest(at.point, b, at.size))
				)?.id;
	const correct = chosen === spec.boxId && boxes.some((b) => b.id === chosen);
	return { correct, reveal: [spec.label], marks: [], ...(chosen === undefined ? {} : { chosen }) };
}

/**
 * Grades `structureRebuild` with `gradeEdgeSet` on from → to (direction matters; labels are not
 * asked; a repeated arrow counts once). Correct when nothing is missing or extra. `reveal` = one
 * line per reference arrow, "A → B" with node labels, in reference order; `marks` = indexes (into
 * the response's edges) of the extra arrows.
 *
 * @see BUILD_PLAN §7.2, §6.10 (set comparison); Decisions log "Phase 6 Q8"
 */
export function checkConnect(
	spec: ConnectSpec,
	response: Extract<ExerciseResponse, { shape: 'connect' }>
): ExerciseVerdict {
	const { result } = gradeEdgeSet(response.edges, spec.edges);
	const key = (e: { from: string; to: string }) => `${e.from}>${e.to}`;
	const reference = new Set(spec.edges.map(key));
	const marks = response.edges.flatMap((e, i) => (reference.has(key(e)) ? [] : [i]));
	const labels = new Map(spec.figure.nodes.map((n) => [n.id, n.label ?? '']));
	const name = (id: string) => labels.get(id) ?? '';
	return {
		correct: result.correct,
		reveal: spec.edges.map((e) => `${name(e.from)} → ${name(e.to)}`),
		marks
	};
}
