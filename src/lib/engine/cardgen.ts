import type { ExerciseKind } from '#lib/db/schemas/common.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import { assertNever } from '#lib/util/result.ts';
import type { Traced } from './trace.ts';

/** What card generation reads from a note. */
export type NoteContent<N extends Note = Note> = N extends unknown
	? Pick<N, 'type' | 'payload'>
	: never;

type ContentOf<T extends Note['type']> = Extract<NoteContent, { type: T }>;

/** One card a note should have. @see DATA_MODEL §4.3 */
export interface CardSpec {
	variant: string;
	path: ExerciseKind[];
}

/** Matches one cloze answer, as `{{answer}}`. Stateless in `matchAll` and `replace`. */
export const CLOZE_SPAN = /\{\{(.*?)\}\}/g;

/**
 * The answers in a cloze text, in order. An answer is numbered by its position: c1, c2…
 *
 * @see DATA_MODEL §4.2
 */
export function clozeAnswers(text: string): string[] {
	return [...text.matchAll(CLOZE_SPAN)].map((match) => (match[1] ?? '').trim());
}

const MC_THEN_CLOZE: ExerciseKind[] = ['mc', 'cloze'];

function sequenceCards({ payload }: ContentOf<'sequence'>): CardSpec[] {
	const nextStepCards = payload.steps.slice(0, -1).map((_step, index) => ({
		variant: `step:${index}`,
		path: ['whichOne', 'cloze'] satisfies ExerciseKind[]
	}));
	return [{ variant: 'seq', path: ['sequence', 'parsons'] }, ...nextStepCards];
}

function compareCards({ payload }: ContentOf<'compare'>): CardSpec[] {
	return payload.rows.flatMap((row, r): CardSpec[] => [
		{ variant: `row:${r}`, path: ['tableRow'] },
		...row.values.map((_value, c): CardSpec => ({ variant: `cell:${r}:${c}`, path: ['cloze'] })),
		{ variant: `which:${r}`, path: ['whichOne', 'scenario'] }
	]);
}

function exampleCards({ payload }: ContentOf<'example'>): CardSpec[] {
	const fades: ExerciseKind[] = payload.steps.map(() => 'fadeStep');
	return [{ variant: 'ex', path: ['exampleStudy', ...fades, 'newInstance', 'subgoalMatch'] }];
}

function diagramCards({ payload }: ContentOf<'diagram'>): CardSpec[] {
	if (payload.kind === 'stack') {
		return [
			{ variant: 'layers', path: ['layerOrder'] },
			...payload.nodes.map((node): CardSpec => ({
				variant: `layer:${node.id}`,
				path: ['nodeCloze']
			}))
		];
	}
	return [
		...payload.nodes.map((node): CardSpec => ({ variant: `node:${node.id}`, path: ['nodeCloze'] })),
		...payload.edges.map((edge): CardSpec => ({ variant: `edge:${edge.id}`, path: ['edgeCloze'] })),
		{ variant: 'rebuild', path: ['structureRebuild'] }
	];
}

function cardsForNote(note: NoteContent): CardSpec[] {
	switch (note.type) {
		case 'keyterm':
			return [{ variant: 'fwd', path: MC_THEN_CLOZE }];
		case 'fact':
			return [
				{ variant: 'fwd', path: MC_THEN_CLOZE },
				{ variant: 'rev', path: MC_THEN_CLOZE }
			];
		case 'cloze':
			return clozeAnswers(note.payload.text).map((_answer, index) => ({
				variant: `c${index + 1}`,
				path: ['cloze']
			}));
		case 'sequence':
			return sequenceCards(note);
		case 'compare':
			return compareCards(note);
		case 'scenario':
			return [{ variant: 'fwd', path: ['scenario'] }];
		case 'example':
			return exampleCards(note);
		case 'diagram':
			return diagramCards(note);
		case 'occlusion':
			return note.payload.boxes.map((box) => ({
				variant: `box:${box.id}`,
				path: ['occlusionBank', 'occlusionType']
			}));
		default:
			return assertNever(note);
	}
}

/**
 * The cards a note should have, with their fixed exercise paths.
 *
 * @see BUILD_PLAN §5
 * @see DATA_MODEL §4.3
 */
export function generateCards(note: NoteContent): Traced<CardSpec[]> {
	const result = cardsForNote(note);
	return { result, trace: [{ rule: 'fixed-path', type: note.type, cards: result.length }] };
}
