import { PRACTICE_SESSION_CARDS } from '#lib/config/defaults.ts';
import type { CardRepo, CourseRepo, NoteRepo, TopicRepo } from '#lib/db/repos/content-repos.ts';
import type { Card } from '#lib/db/schemas/card.ts';
import type { CourseId, NoteId } from '#lib/db/schemas/common.ts';
import type { Course } from '#lib/db/schemas/course.ts';
import type { Note, NoteType } from '#lib/db/schemas/note.ts';
import { generateCards } from '#lib/engine/cardgen.ts';
import type { ExerciseCard, ExerciseNote } from '#lib/engine/exercise-spec.ts';

/** Note types whose exercises need the diagram view (Phase 6); practice sessions leave them out. */
const DIAGRAM_NOTES: ReadonlySet<NoteType> = new Set(['diagram', 'occlusion']);

/** A course's live cards and notes, ordered by topic, note and card. */
export interface CourseMaterial {
	course: Course;
	cards: Card[];
	notes: Map<NoteId, Note>;
}

/** What the exercise builder reads about the course. */
export function exerciseCourse(material: CourseMaterial): {
	cards: ExerciseCard[];
	notes: Map<NoteId, ExerciseNote>;
} {
	return {
		cards: material.cards.map(({ id, noteId, variant }) => ({ id, noteId, variant })),
		notes: material.notes as Map<NoteId, ExerciseNote>
	};
}

function variantRank(note: Note): Map<string, number> {
	return new Map(generateCards(note).result.map((spec, i) => [spec.variant, i]));
}

/**
 * Loads a course's live material: cards in topic order, then note order, then the order
 * `generateCards` gives a note's variants.
 *
 * @see Decisions log (Phase 5: practice sessions)
 */
export async function loadCourse(
	repos: { courses: CourseRepo; topics: TopicRepo; notes: NoteRepo; cards: CardRepo },
	courseId: CourseId
): Promise<CourseMaterial> {
	const course = await repos.courses.get(courseId);
	if (!course) throw new Error(`No course ${courseId}`);
	const topics = (await repos.topics.listByCourse(courseId)).sort((a, b) => a.order - b.order);
	const notes: Note[] = [];
	for (const topic of topics) notes.push(...(await repos.notes.listByTopic(topic.id)));
	const noteRank = new Map(notes.map((note, i) => [note.id, i]));
	const ranks = new Map(notes.map((note) => [note.id, variantRank(note)]));
	const cards = (await repos.cards.listByCourse(courseId))
		.filter((card) => noteRank.has(card.noteId))
		.sort(
			(a, b) =>
				(noteRank.get(a.noteId) ?? 0) - (noteRank.get(b.noteId) ?? 0) ||
				(ranks.get(a.noteId)?.get(a.variant) ?? 0) - (ranks.get(b.noteId)?.get(b.variant) ?? 0)
		);
	return { course, cards, notes: new Map(notes.map((note) => [note.id, note])) };
}

/**
 * The cards of a Phase 5 practice session: unsuspended, not diagram or occlusion, in course order,
 * at most `PRACTICE_SESSION_CARDS`. Phase 7's modes replace this.
 *
 * @see Decisions log (Phase 5: practice sessions)
 */
export function practiceCards(material: CourseMaterial): Card[] {
	return material.cards
		.filter((card) => !card.suspended)
		.filter((card) => {
			const note = material.notes.get(card.noteId);
			return note !== undefined && !DIAGRAM_NOTES.has(note.type);
		})
		.slice(0, PRACTICE_SESSION_CARDS);
}
