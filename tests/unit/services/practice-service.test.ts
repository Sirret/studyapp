import { afterEach, describe, expect, it } from 'vitest';
import type { CardId } from '#lib/db/schemas/common.ts';
import type { ReviewEvent } from '#lib/db/schemas/event.ts';
import { quickQuiz } from '#lib/engine/practice.ts';
import { PracticeService } from '#lib/services/practice-service.ts';
import { ScopeService } from '#lib/services/scope-service.ts';
import { loadCourse } from '#lib/services/study-course.ts';
import type { ExerciseResponse, ExerciseSpec, StudyView } from '#lib/services/study-types.ts';
import { LEARN_COURSE_TEXT, outline } from './learn-fixtures.ts';
import { rightResponse, studyStack, type StudyStack } from './study-fixtures.ts';

let env: StudyStack | undefined;
afterEach(async () => {
	await env?.db.delete();
	env = undefined;
});

async function setup() {
	env = await studyStack(LEARN_COURSE_TEXT);
	const practice = new PracticeService({
		study: env.study,
		repos: env.repos,
		events: env.events,
		kv: env.kv,
		logger: env.logger
	});
	const scope = new ScopeService({ repos: env.repos, kv: env.kv, logger: env.logger });
	return { env, practice, scope };
}

/** A wrong response to a spec, for shapes the quiz uses. */
function wrongResponse(spec: ExerciseSpec): ExerciseResponse {
	switch (spec.shape) {
		case 'type':
			return { shape: 'type', typed: 'zzzz' };
		case 'choose':
			return { shape: 'choose', index: spec.correctIndex === 0 ? 1 : 0 };
		default:
			throw new Error(`fixture: no wrong response for ${spec.shape}`);
	}
}

/** Plays a session to its end; `wrongFirst` gets one wrong answer on its first showing. */
async function play(stack: StudyStack, start: StudyView, wrongFirst?: CardId): Promise<StudyView> {
	let view = start;
	let missed = false;
	for (let step = 0; step < 200 && !view.ended; step += 1) {
		if (view.round) {
			view = await stack.study.continueRound(view.sessionId, { afterBreak: false });
			continue;
		}
		const item = view.item;
		if (!item) break;
		const miss: boolean = !missed && item.cardId === wrongFirst;
		missed ||= miss;
		const response = miss ? wrongResponse(item.exercise) : rightResponse(item.exercise);
		view = (await stack.study.submit(view.sessionId, response)).view;
	}
	return view;
}

/** @see SESSION_NOTES §C, J; Decisions log "Phase 8.6 Q4", "Q16", "Q18" */
describe('PracticeService', () => {
	it('the deck holds every studyable card as a flip, and follows the scope', async () => {
		const { env, practice, scope } = await setup();
		const material = await loadCourse(env.repos, env.courseId);
		const deck = await practice.deck(env.courseId);
		expect(deck.map((c) => c.cardId)).toStrictEqual(material.cards.map((c) => c.id));
		expect(deck.every((c) => c.exercise.kind === 'flip')).toBe(true);
		const { topics } = await outline(env);
		const net = topics[1];
		if (!net) throw new Error('fixture');
		await scope.set(env.courseId, { topicIds: [net.id], chunkIds: [] });
		const scoped = await practice.deck(env.courseId);
		const netNotes = [...material.notes.values()].filter((n) => n.topicId === net.id);
		expect(scoped.length).toBeGreaterThan(0);
		expect(scoped.length).toBeLessThan(deck.length);
		expect(
			scoped.every((c) =>
				netNotes.some((n) => n.id === material.cards.find((m) => m.id === c.cardId)?.noteId)
			)
		).toBe(true);
	});

	it('the next pass keeps the "Still learning" cards in swipe order', async () => {
		const { practice } = await setup();
		const [a, b, c] = ['a', 'b', 'c'] as [CardId, CardId, CardId];
		expect(
			practice.nextPass([
				{ id: a, know: false },
				{ id: b, know: true },
				{ id: c, know: false }
			])
		).toStrictEqual([a, c]);
	});

	it('the quick quiz asks every card once in its rotated kind, uncredited, and never touches FSRS', async () => {
		const { env, practice } = await setup();
		const material = await loadCourse(env.repos, env.courseId);
		const expected = quickQuiz(material.cards.map(({ id, path }) => ({ id, path }))).result;
		const start = await practice.startQuiz(env.courseId);
		expect(start.mode).toBe('practice');
		expect(start.progress.total).toBe(expected.length);
		expect((await env.sessionRepo.get(start.sessionId))?.snapshot.roundBy).toBe('count');
		const end = await play(env, start);
		expect(end.ended).toBe(true);
		const reviews = (await env.events.list()).filter((e): e is ReviewEvent => e.type === 'review');
		expect(reviews.length).toBe(expected.length);
		expect(reviews.every((e) => e.mode === 'practice' && !e.credited)).toBe(true);
		const kinds = new Map(expected.map((q) => [q.id, q.kind]));
		expect(reviews.every((e) => kinds.get(e.cardId) === e.kind)).toBe(true);
		const after = await loadCourse(env.repos, env.courseId);
		expect(after.cards.map((c) => [c.fsrs, c.status, c.pathStep, c.accuracy])).toStrictEqual(
			material.cards.map((c) => [c.fsrs, c.status, c.pathStep, c.accuracy])
		);
	});

	it('the summary lists a missed card, which came back and was answered again', async () => {
		const { env, practice } = await setup();
		const start = await practice.startQuiz(env.courseId);
		const first = start.item?.cardId;
		if (!first) throw new Error('fixture');
		const end = await play(env, start, first);
		const summary = await practice.quizSummary(end.sessionId);
		expect(summary.missed).toStrictEqual([first]);
		expect(summary.asked).toBe(start.progress.total);
		expect(summary.right).toBe(start.progress.total - 1);
		const answers = (await env.events.list())
			.filter((e): e is ReviewEvent => e.type === 'review' && e.cardId === first)
			.sort((a, b) => a.seq - b.seq);
		expect(answers.map((e) => e.correct)).toStrictEqual([
			false,
			...answers.slice(1).map(() => true)
		]);
		expect(answers.length).toBeGreaterThan(1);
	});
});
