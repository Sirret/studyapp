import { expect } from 'vitest';
import type { CardId, ExerciseKind, NoteId } from '#lib/db/schemas/common.ts';
import { generateCards, type NoteContent } from '#lib/engine/cardgen.ts';
import {
	buildExercise,
	type ExerciseCard,
	type ExerciseInput,
	type ExerciseNote,
	type ExerciseShape,
	type ExerciseSpec
} from '#lib/engine/exercise-spec.ts';
import { rngFor } from '#lib/engine/rng.ts';
import type { Traced } from '#lib/engine/trace.ts';
import { cardId, noteId, SESSION, topicId } from './fixtures.ts';

/** A note as a test writes it; note `n` (1-based position in the list) gets `noteId(n)`. */
export interface NoteDef {
	content: NoteContent;
	topic?: number;
	order?: number;
	tags?: string[];
	accept?: Record<string, string[]>;
}

export interface CourseCard extends ExerciseCard {
	path: ExerciseKind[];
}

export interface TestCourse {
	cards: CourseCard[];
	notes: Map<NoteId, ExerciseNote>;
}

export const keyterm = (term: string, meaning: string): NoteContent => ({
	type: 'keyterm',
	payload: { term, meaning }
});
export const fact = (term: string, definition: string): NoteContent => ({
	type: 'fact',
	payload: { term, definition }
});
export const cloze = (text: string): NoteContent => ({ type: 'cloze', payload: { text } });
export const sequence = (name: string, steps: string[]): NoteContent => ({
	type: 'sequence',
	payload: { name, steps }
});
export const example = (name: string, steps: [string, string][]): NoteContent => ({
	type: 'example',
	payload: { name, steps: steps.map(([subgoal, step]) => ({ subgoal, step })) }
});
export const compare = (items: string[], rows: [string, string[]][]): NoteContent => ({
	type: 'compare',
	payload: { items, rows: rows.map(([attribute, values]) => ({ attribute, values })) }
});
export const scenario = (situation: string, answer: string): NoteContent => ({
	type: 'scenario',
	payload: { situation, answer }
});

/** Card `j` (0-based) of note `n` gets `cardId(n * 100 + j + 1)`. */
export const cardIdOf = (n: number, j: number): CardId => cardId(n * 100 + j + 1);

/**
 * A course from note definitions. Cards come from the real `generateCards`, in note order then
 * card order, so variants and paths are the ones the app stores.
 */
export function buildCourse(defs: readonly NoteDef[]): TestCourse {
	const notes = new Map<NoteId, ExerciseNote>();
	const cards: CourseCard[] = [];
	defs.forEach((def, i) => {
		const n = i + 1;
		const id = noteId(n);
		const note = {
			...def.content,
			id,
			topicId: topicId(def.topic ?? 1),
			tags: def.tags ?? [],
			order: def.order ?? i,
			accept: def.accept ?? {}
		} as ExerciseNote;
		notes.set(id, note);
		generateCards(def.content).result.forEach((spec, j) => {
			cards.push({ id: cardIdOf(n, j), noteId: id, variant: spec.variant, path: spec.path });
		});
	});
	return { cards, notes };
}

export function cardOf(course: TestCourse, n: number, variant: string): CourseCard {
	const found = course.cards.find((c) => c.noteId === noteId(n) && c.variant === variant);
	if (!found) throw new Error(`fixture: note ${n} has no card ${variant}`);
	return found;
}

export function noteOf(course: TestCourse, n: number): ExerciseNote {
	const found = course.notes.get(noteId(n));
	if (!found) throw new Error(`fixture: no note ${n}`);
	return found;
}

export interface BuildOptions {
	/** Path index of the shown kind; defaults to the kind's first index in the path, else 0. */
	step?: number;
	attempt?: number;
	confusions?: Map<CardId, number>;
	/** Cards in this order instead of the course's. */
	cards?: CourseCard[];
}

export function inputFor(
	course: TestCourse,
	card: CourseCard,
	kind: ExerciseKind,
	options: BuildOptions = {}
): ExerciseInput {
	const index = card.path.indexOf(kind);
	return {
		kind,
		card: { ...card, step: options.step ?? (index >= 0 ? index : 0) },
		course: { cards: options.cards ?? course.cards, notes: course.notes },
		confusions: options.confusions ?? new Map(),
		rng: rngFor(card.id, SESSION, options.attempt ?? 0)
	};
}

export function build(
	course: TestCourse,
	n: number,
	variant: string,
	kind: ExerciseKind,
	options: BuildOptions = {}
): Traced<ExerciseSpec> {
	return buildExercise(inputFor(course, cardOf(course, n, variant), kind, options));
}

/** Asserts the spec's shape and narrows it. */
export function asShape<S extends ExerciseShape>(
	spec: ExerciseSpec,
	shape: S
): Extract<ExerciseSpec, { shape: S }> {
	expect(spec.shape).toBe(shape);
	return spec as Extract<ExerciseSpec, { shape: S }>;
}

export const sorted = (texts: readonly string[]): string[] => [...texts].sort();
