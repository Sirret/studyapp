import type { IdeaUnitSpec, ListSpec } from './exercise-types.ts';
import type { ExerciseResponse, ExerciseVerdict } from './exercise-check.ts';

type ResponseOf<S extends ExerciseResponse['shape']> = Extract<ExerciseResponse, { shape: S }>;

/**
 * Grades an idea-unit answer through `gradeIdeaUnit`: correct when every key word is ticked;
 * `weight: 'recognition'` when the student ticked a key word the app didn't pre-tick;
 * `verdictKind: 'ideaUnit'`; `chosen` = the typed text; `marks` = the key words left unticked.
 *
 * @see BUILD_PLAN §5.1 row ideaUnit and Decisions log "Phase 8.6 Q1"
 */
export function checkIdeaUnit(
	_spec: IdeaUnitSpec,
	_response: ResponseOf<'ideaUnit'>
): ExerciseVerdict {
	throw new Error('not implemented');
}

/**
 * Grades a list answer through `gradeListTyped` or `gradeListPicked`; `verdictKind: 'listN'`;
 * `reveal` = every item of the list; `marks` = wrong entries (typed) or wrong picks (option indexes).
 *
 * @see BUILD_PLAN §5.1 row listN and Decisions log "Phase 8.6 Q9"
 */
export function checkList(_spec: ListSpec, _response: ResponseOf<'list'>): ExerciseVerdict {
	throw new Error('not implemented');
}
