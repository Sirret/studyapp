import { afterEach, describe, expect, it } from 'vitest';
import type { CardId } from '#lib/db/schemas/common.ts';
import type { ReviewEvent } from '#lib/db/schemas/event.ts';
import { SAMPLE_COURSE_TEXT } from '#lib/services/dev-sample.ts';
import { loadCourse } from '#lib/services/study-course.ts';
import { rightResponse, studyStack, type StudyStack } from './study-fixtures.ts';

let env: StudyStack | undefined;
afterEach(async () => {
	await env?.db.delete();
	env = undefined;
});

async function clozeCard(stack: StudyStack): Promise<CardId> {
	const material = await loadCourse(stack.repos, stack.courseId);
	const id = material.cards.find(
		(card) => material.notes.get(card.noteId)?.type === 'cloze' && card.variant === 'c2'
	)?.id;
	if (!id) throw new Error('fixture');
	return id;
}

async function reviews(stack: StudyStack): Promise<ReviewEvent[]> {
	return (await stack.events.list()).filter((e): e is ReviewEvent => e.type === 'review');
}

/** @see SESSION_NOTES J (micro hint); Decisions log "Phase 8.6 Q3", "Q4", "Q10", "Q16" */
describe('StudyService: hints, credit and count rounds', () => {
	it('a hint on a typed exercise reveals letters and the answer is logged hinted', async () => {
		env = await studyStack(SAMPLE_COURSE_TEXT);
		const id = await clozeCard(env);
		const view = await env.study.startCourse(env.courseId, {
			cardIds: [id],
			forceKinds: { [id]: 'cloze' }
		});
		const hint = env.study.hint(view.sessionId);
		expect(hint).toStrictEqual({ kind: 'reveal', text: 'ne______' });
		expect(env.study.hint(view.sessionId)).toStrictEqual(hint);
		const item = view.item;
		if (!item) throw new Error('fixture');
		const answer = await env.study.submit(view.sessionId, rightResponse(item.exercise));
		expect(answer.verdict.correct).toBe(true);
		expect(await reviews(env)).toMatchObject([{ cardId: id, hinted: true, correct: true }]);
		// The hinted correct did not count: the card is still in the session.
		expect(answer.view.ended).toBe(false);
	});

	it('an answer without a hint has no hinted field', async () => {
		env = await studyStack(SAMPLE_COURSE_TEXT);
		const id = await clozeCard(env);
		const view = await env.study.startCourse(env.courseId, {
			cardIds: [id],
			forceKinds: { [id]: 'cloze' }
		});
		const item = view.item;
		if (!item) throw new Error('fixture');
		await env.study.submit(view.sessionId, rightResponse(item.exercise));
		const [event] = await reviews(env);
		expect(event?.hinted).toBeUndefined();
		expect(event?.credited).toBe(true);
	});

	it('a typo accepted as right is logged verdictKind fuzzy', async () => {
		env = await studyStack(SAMPLE_COURSE_TEXT);
		const id = await clozeCard(env);
		const view = await env.study.startCourse(env.courseId, {
			cardIds: [id],
			forceKinds: { [id]: 'cloze' }
		});
		const answer = await env.study.submit(view.sessionId, { shape: 'type', typed: 'netwroks' });
		expect(answer.verdict.correct).toBe(true);
		expect((await reviews(env))[0]?.verdictKind).toBe('fuzzy');
	});

	it.each(['practice', 'acquisition'] as const)(
		'%s answers are logged uncredited, with count rounds when planned',
		async (mode) => {
			env = await studyStack(SAMPLE_COURSE_TEXT);
			const id = await clozeCard(env);
			const view = await env.study.startPlanned(env.courseId, {
				mode,
				cards: [{ id, kind: 'cloze', required: 1 }],
				plannedMinutes: 0,
				roundBy: 'count'
			});
			const saved = await env.sessionRepo.get(view.sessionId);
			expect(saved?.snapshot.roundBy).toBe('count');
			const item = view.item;
			if (!item) throw new Error('fixture');
			await env.study.submit(view.sessionId, rightResponse(item.exercise));
			expect(await reviews(env)).toMatchObject([{ mode, credited: false }]);
		}
	);
});
