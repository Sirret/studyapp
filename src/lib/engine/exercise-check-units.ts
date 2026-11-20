import type { IdeaUnitSpec, ListSpec } from './exercise-types.ts';
import type { ExerciseResponse, ExerciseVerdict } from './exercise-check.ts';
import { normalizeAnswer } from './grading.ts';
import { gradeIdeaUnit } from './idea-unit.ts';
import { gradeListPicked, gradeListTyped } from './list-grading.ts';

type ResponseOf<S extends ExerciseResponse['shape']> = Extract<ExerciseResponse, { shape: S }>;

/**
 * Grades an idea-unit answer through `gradeIdeaUnit`: correct when every key word is ticked;
 * `weight: 'recognition'` when the student ticked a key word the app didn't pre-tick;
 * `verdictKind: 'ideaUnit'`; `chosen` = the typed text; `marks` = the key words left unticked.
 *
 * @see BUILD_PLAN §5.1 row ideaUnit and Decisions log "Phase 8.6 Q1"
 */
export function checkIdeaUnit(
	spec: IdeaUnitSpec,
	response: ResponseOf<'ideaUnit'>
): ExerciseVerdict {
	const { result } = gradeIdeaUnit({
		typed: response.typed,
		keyWords: spec.keyWords,
		ticked: response.ticked
	});
	return {
		correct: result.correct,
		reveal: [spec.answer],
		chosen: normalizeAnswer(response.typed),
		marks: result.missing,
		verdictKind: 'ideaUnit',
		...(result.weight === 'recognition' ? { weight: 'recognition' as const } : {})
	};
}

/**
 * Grades a list answer through `gradeListTyped` or `gradeListPicked`; `verdictKind: 'listN'`;
 * `reveal` = every item of the list; `marks` = wrong entries (typed) or wrong picks (option indexes).
 *
 * @see BUILD_PLAN §5.1 row listN and Decisions log "Phase 8.6 Q9"
 */
export function checkList(spec: ListSpec, response: ResponseOf<'list'>): ExerciseVerdict {
	const typed = spec.entry === 'type';
	const { result } = typed
		? gradeListTyped({
				cardId: spec.cardId,
				items: spec.items,
				typed: response.typed,
				required: spec.required
			})
		: gradeListPicked({ correct: spec.correct, picked: response.picked, required: spec.required });
	const chosen = typed
		? response.typed.map(normalizeAnswer).filter((text) => text !== '')
		: response.picked.map((i) => spec.options[i]?.text ?? '');
	return {
		correct: result.correct,
		reveal: [...spec.items],
		chosen: chosen.join(', '),
		marks: result.wrong,
		verdictKind: 'listN'
	};
}
