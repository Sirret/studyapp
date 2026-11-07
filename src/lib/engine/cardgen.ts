import type { ExerciseKind } from '#lib/db/schemas/common.ts';
import type { Note } from '#lib/db/schemas/note.ts';

/** What card generation reads from a note. */
export type NoteContent<N extends Note = Note> = N extends unknown
	? Pick<N, 'type' | 'payload'>
	: never;

/** One card a note should have. @see DATA_MODEL §4.3 */
export interface CardSpec {
	variant: string;
	path: ExerciseKind[];
}

/**
 * The answers in a cloze text, in order. An answer is numbered by its position: c1, c2…
 *
 * @see DATA_MODEL §4.2
 */
export function clozeAnswers(_text: string): string[] {
	throw new Error('not implemented');
}

/**
 * The cards a note should have, with their fixed exercise paths.
 *
 * @see BUILD_PLAN §5
 * @see DATA_MODEL §4.3
 */
export function generateCards(_note: NoteContent): CardSpec[] {
	throw new Error('not implemented');
}
