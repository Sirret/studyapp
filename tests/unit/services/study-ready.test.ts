import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardId } from '#lib/db/schemas/common.ts';
import { SAMPLE_COURSE_TEXT } from '#lib/services/dev-sample.ts';
import { loadCourse } from '#lib/services/study-course.ts';
import { rightResponse, studyStack, type StudyStack } from './study-fixtures.ts';

let env: StudyStack | undefined;
afterEach(async () => {
	await env?.db.delete();
	env = undefined;
});

async function startOne(stack: StudyStack) {
	const material = await loadCourse(stack.repos, stack.courseId);
	const id = material.cards.find(
		(card) => material.notes.get(card.noteId)?.type === 'cloze' && card.variant === 'c2'
	)?.id as CardId;
	const view = await stack.study.startCourse(stack.courseId, {
		cardIds: [id],
		forceKinds: { [id]: 'cloze' }
	});
	if (!view.item) throw new Error('fixture');
	return { id, view, exercise: view.item.exercise };
}

/** @see SESSION_NOTES §D7 (a stamp sound when a card becomes exam-ready) */
describe('StudyService.submit: becameReady', () => {
	it('is false for an answer that leaves a new card short of exam-ready', async () => {
		env = await studyStack(SAMPLE_COURSE_TEXT);
		const { view, exercise } = await startOne(env);
		const answer = await env.study.submit(view.sessionId, rightResponse(exercise));
		expect(answer.becameReady).toBe(false);
	});

	it('is true when the replay after this answer makes the card exam-ready', async () => {
		const stack = await studyStack(SAMPLE_COURSE_TEXT);
		env = stack;
		const { id, view, exercise } = await startOne(stack);
		// Stand-in replay: the rebuilt card comes back exam-ready.
		vi.spyOn(stack.replay, 'rebuildCards').mockImplementation(async () => {
			await stack.db.cards.update(id, { status: 'exam-ready' });
		});
		const answer = await stack.study.submit(view.sessionId, rightResponse(exercise));
		expect(answer.becameReady).toBe(true);
	});

	it('is false when the card was already exam-ready before the answer', async () => {
		const stack = await studyStack(SAMPLE_COURSE_TEXT);
		env = stack;
		const { id, view, exercise } = await startOne(stack);
		await stack.db.cards.update(id, { status: 'exam-ready' });
		vi.spyOn(stack.replay, 'rebuildCards').mockImplementation(async () => {});
		const answer = await stack.study.submit(view.sessionId, rightResponse(exercise));
		expect(answer.becameReady).toBe(false);
	});
});
