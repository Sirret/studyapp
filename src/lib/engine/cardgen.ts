import type { ExerciseKind } from '#lib/db/schemas/common.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import { assertNever } from '#lib/util/result.ts';
import { listPath } from './list-grading.ts';
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

/**
 * A fact's cards. A starred list makes only `fwd` ("malware, phishing, … → ?" has no meaning), on
 * the list path (`listPath`). A fact with key words asks its definition as an idea unit after MC
 * (`ideaUnit` replaces the verbatim `cloze`). The reverse card is always MC then typed term.
 *
 * @see SESSION_NOTES D3, D4; Decisions log "Phase 8.6 Q1", "Q9"
 */
function factCards(payload: { keyWords?: readonly string[]; list?: boolean }): CardSpec[] {
	const keyWords = payload.keyWords ?? [];
	if (payload.list && keyWords.length > 0)
		return [{ variant: 'fwd', path: listPath(keyWords.length) }];
	const fwdPath: ExerciseKind[] = keyWords.length > 0 ? ['mc', 'ideaUnit'] : MC_THEN_CLOZE;
	const fwd: CardSpec = { variant: 'fwd', path: fwdPath };
	return payload.list ? [fwd] : [fwd, { variant: 'rev', path: MC_THEN_CLOZE }];
}

function cardsForNote(note: NoteContent): CardSpec[] {
	switch (note.type) {
		case 'keyterm':
			return [{ variant: 'fwd', path: MC_THEN_CLOZE }];
		case 'fact':
			return factCards(note.payload);
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
			// A box with no label yet has no card; `unplaced` labels have none either (Phase 6 Q10–Q13).
			return note.payload.boxes
				.filter((box) => box.label.trim() !== '')
				.map((box) => ({
					variant: `box:${box.id}`,
					path: ['occlusionBank', 'occlusionDrag', 'occlusionType']
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
