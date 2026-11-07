import type { CardId } from '#lib/db/schemas/common.ts';
import type { ExerciseSpec } from './exercise-spec.ts';
import type { Traced } from './trace.ts';

/** The student's response, matching the spec's `shape`. @see BUILD_PLAN §5.1 */
export type ExerciseResponse =
	| { shape: 'type'; typed: string }
	| { shape: 'choose'; index: number }
	| { shape: 'chooseMany'; indexes: number[] }
	| { shape: 'order'; order: number[] }
	| { shape: 'pair'; matches: number[] }
	| { shape: 'sort'; placed: number[] }
	| { shape: 'selfRate'; rating?: 'again' | 'hard' | 'good'; checked: number[] }
	| { shape: 'study' };

/** The verdict and what feedback shows. @see BUILD_PLAN §5.1 (feedback) and §6.4 */
export interface ExerciseVerdict {
	correct: boolean;
	/** The right answer as text; one line per part for shapes with several parts. */
	reveal: string[];
	/** The normalised typed text, or the chosen option text(s). */
	chosen?: string;
	/** Another card whose answer the student gave instead (confusion pair). */
	chosenFromCardId?: CardId;
	/** "You chose X — that's the answer to Y". */
	contrast?: { chosen: string; answers: string };
	/** The wrong parts: item, left or option indexes. */
	marks: number[];
}

/**
 * Grades a response against its spec. Self-rated and study shapes are never graded and return
 * `correct: true`. Throws if the response's shape doesn't match the spec's (a caller bug).
 *
 * @see BUILD_PLAN §5.1 and §6.10
 */
export function checkResponse(
	spec: ExerciseSpec,
	response: ExerciseResponse
): Traced<ExerciseVerdict> {
	void spec;
	void response;
	throw new Error('not implemented');
}
