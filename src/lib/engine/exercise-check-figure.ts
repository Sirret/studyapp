import type { ExerciseResponse, ExerciseVerdict } from './exercise-check.ts';
import type { ConnectSpec, PlaceSpec } from './exercise-types.ts';

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
	void spec;
	void response;
	throw new Error('not implemented');
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
	void spec;
	void response;
	throw new Error('not implemented');
}
