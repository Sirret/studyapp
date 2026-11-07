import type { Note } from '#lib/db/schemas/note.ts';
import type { SessionId } from '#lib/db/schemas/common.ts';
import { cardAnswer } from '#lib/engine/answers.ts';
import { sampleKindPlan, SAMPLE_COURSE_TEXT, type SampleCard } from './dev-sample.ts';
import { importService } from './import-wiring.ts';
import { studyService, studyRepos } from './study-wiring.ts';
import { loadCourse } from './study-course.ts';

/** A note's term, name, first item or situation: what the sample plan names it by. */
function noteKey(note: Note): string {
	switch (note.type) {
		case 'keyterm':
		case 'fact':
			return note.payload.term;
		case 'sequence':
		case 'example':
			return note.payload.name;
		case 'compare':
			return note.payload.items[0] ?? '';
		case 'scenario':
			return note.payload.situation;
		default:
			return cardAnswer(note, 'c1')?.text ?? '';
	}
}

/**
 * Dev and e2e only: imports the sample course through the real import pipeline and starts a
 * session that shows every non-diagram exercise kind once (then each card's own path).
 *
 * @see Decisions log (Phase 5: e2e harness)
 */
export async function startSampleSession(): Promise<SessionId> {
	const course = await importService.createCourse(
		`Sample ${new Date().toISOString().slice(11, 19)}`
	);
	const preview = await importService.preview(course.id, SAMPLE_COURSE_TEXT, []);
	const committed = await importService.commit(course.id, preview, new Map());
	if (!committed.ok) throw new Error(committed.error);
	const material = await loadCourse(studyRepos, course.id);
	const cards: SampleCard[] = material.cards.map((card) => {
		const note = material.notes.get(card.noteId);
		if (!note) throw new Error(`Card ${card.id} has no note`);
		return { id: card.id, variant: card.variant, noteType: note.type, noteKey: noteKey(note) };
	});
	const view = await studyService.startCourse(course.id, sampleKindPlan(cards));
	return view.sessionId;
}
