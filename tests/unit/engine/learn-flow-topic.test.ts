import { describe, expect, it } from 'vitest';
import { LOOKBACK_MIN_DISTANCE } from '#lib/config/defaults.ts';
import type { ExerciseKind } from '#lib/db/schemas/common.ts';
import {
	meetTerms,
	sectionQuestions,
	topicFlow,
	type LearnCard,
	type LearnSection,
	type MeetNote
} from '#lib/engine/learn-flow.ts';
import { cardId, chunkId, noteId, topicId } from './fixtures.ts';

/**
 * The Learn door: a topic's steps (split from learn-flow.test.ts for file length).
 *
 * @see SESSION_NOTES §C, D2, H; PROMPTS §6; Decisions log "Phase 8.6 Q2", "Q6", "Q7", "Q13"
 */

const T1 = topicId(1);
const T2 = topicId(2);
const S = (n: number) => chunkId(100 + n);

const section = (n: number, t = T1, extra: Partial<LearnSection> = {}): LearnSection => ({
	chunkId: S(n),
	topicId: t,
	added: false,
	words: 200,
	...extra
});

const note = (
	n: number,
	type: MeetNote['type'],
	term: string,
	extra: Partial<MeetNote> = {}
): MeetNote => ({
	id: noteId(n),
	chunkId: S(1),
	type,
	term,
	list: false,
	...extra
});

let cardCounter = 0;
const lcard = (
	chunk: number | null,
	kind: ExerciseKind = 'mc',
	extra: Partial<LearnCard> = {}
): LearnCard => {
	cardCounter += 1;
	return {
		id: cardId(cardCounter),
		noteId: noteId(1000 + cardCounter),
		topicId: T1,
		chunkId: chunk === null ? null : S(chunk),
		kind,
		lastCorrect: null,
		lastSeenAt: null,
		...extra
	};
};

describe('topicFlow', () => {
	const run = (
		input: Partial<Parameters<typeof topicFlow>[0]> &
			Pick<Parameters<typeof topicFlow>[0], 'sections'>
	) => topicFlow({ topicId: T1, hasSummary: true, cards: [], notes: [], ...input }).result;
	const stepsOf = (steps: ReturnType<typeof run>) => steps.map((s) => s.step);

	it('starts and ends with the summary when the topic has one', () => {
		const steps = run({ sections: [section(1)] });
		expect(steps[0]).toEqual({ step: 'summary', topicId: T1, at: 'start' });
		expect(steps[steps.length - 1]).toEqual({ step: 'summary', topicId: T1, at: 'end' });
	});

	it('has no summary steps when the topic has none', () => {
		expect(stepsOf(run({ hasSummary: false, sections: [section(1)] }))).toEqual(['read']);
	});

	it('gives a section meetTerms, read, questions in that order', () => {
		const notes = [note(1, 'keyterm', 'tcp'), note(2, 'keyterm', 'udp')];
		const cards = [lcard(1), lcard(1), lcard(1)];
		const steps = run({ hasSummary: false, sections: [section(1)], notes, cards });
		expect(stepsOf(steps).slice(0, 3)).toEqual(['meetTerms', 'read', 'questions']);
		const meet = steps[0];
		expect(meet).toMatchObject({ step: 'meetTerms', chunkId: S(1) });
		expect(meet && meet.step === 'meetTerms' && meet.terms).toEqual(meetTerms(S(1), notes).result);
		const q = steps[2];
		expect(q && q.step === 'questions' && q.cardIds).toEqual(
			sectionQuestions(cards).result.questions
		);
	});

	it('leaves out read when the section has no words, and questions when it has no cards', () => {
		const steps = run({ hasSummary: false, sections: [section(1, T1, { words: 0 })] });
		expect(steps).toEqual([]);
	});

	it('leaves out meetTerms when the section has fewer than MEET_TERMS_MIN terms', () => {
		const steps = run({
			hasSummary: false,
			sections: [section(1)],
			notes: [note(1, 'keyterm', 'tcp')]
		});
		expect(stepsOf(steps)).toEqual(['read']);
	});

	it('adds a look-back only from section index LOOKBACK_MIN_DISTANCE of the course order', () => {
		const sections = Array.from({ length: LOOKBACK_MIN_DISTANCE + 2 }, (_x, i) => section(i + 1));
		const steps = run({ hasSummary: false, sections });
		const lookBacks = steps
			.filter((s) => s.step === 'lookBack')
			.map((s) => 'chunkId' in s && s.chunkId);
		expect(lookBacks).toEqual(sections.slice(LOOKBACK_MIN_DISTANCE).map((s) => s.chunkId));
		// The look-back follows the section's own steps.
		const idx = steps.findIndex((s) => s.step === 'lookBack');
		expect(steps[idx - 1]).toEqual({ step: 'read', chunkId: S(LOOKBACK_MIN_DISTANCE + 1) });
	});

	it('counts the section index across the whole course, not within the topic', () => {
		const sections = [section(1, T1), section(2, T1), section(3, T2), section(4, T2)];
		const steps = run({ topicId: T2, hasSummary: false, sections });
		expect(steps.filter((s) => s.step === 'lookBack')).toHaveLength(2);
		expect(steps.filter((s) => s.step === 'read')).toEqual([
			{ step: 'read', chunkId: S(3) },
			{ step: 'read', chunkId: S(4) }
		]);
	});

	it('ignores sections of other topics', () => {
		const steps = run({ hasSummary: false, sections: [section(1, T2), section(2, T1)] });
		expect(steps.filter((s) => s.step === 'read')).toEqual([{ step: 'read', chunkId: S(2) }]);
	});

	it('puts every section rest card in a mixedQuiz, interleaved round-robin across sections', () => {
		const sections = [section(1), section(2), section(3)];
		// Each recall card is asked after its section; the others are the "rest".
		const a = [lcard(1, 'cloze'), lcard(1, 'cloze'), lcard(1), lcard(1)];
		const b = [lcard(2, 'cloze'), lcard(2, 'cloze'), lcard(2)];
		const c = [lcard(3, 'cloze'), lcard(3, 'cloze'), lcard(3), lcard(3)];
		const steps = run({ hasSummary: false, sections, cards: [...a, ...b, ...c] });
		const quiz = steps.find((s) => s.step === 'mixedQuiz');
		expect(quiz && quiz.step === 'mixedQuiz' && quiz.topicId).toBe(T1);
		const restA = a.slice(2).map((x) => x.id);
		const restB = b.slice(2).map((x) => x.id);
		const restC = c.slice(2).map((x) => x.id);
		expect(quiz && quiz.step === 'mixedQuiz' && quiz.cardIds).toEqual([
			restA[0],
			restB[0],
			restC[0],
			restA[1],
			restC[1]
		]);
	});

	it('adds cards with no section to the mixedQuiz', () => {
		const loose = lcard(null);
		const steps = run({ hasSummary: false, sections: [section(1)], cards: [lcard(1), loose] });
		const quiz = steps.find((s) => s.step === 'mixedQuiz');
		// SPEC-GAP: where sectionless cards sit among the interleaved ones (reading: they are included).
		expect(quiz && quiz.step === 'mixedQuiz' && quiz.cardIds).toContain(loose.id);
	});

	it('has no mixedQuiz when there are no rest cards and no sectionless cards', () => {
		const steps = run({ hasSummary: false, sections: [section(1)], cards: [lcard(1)] });
		expect(stepsOf(steps)).not.toContain('mixedQuiz');
	});

	it('shows added sections last, in an added step, and not as normal sections', () => {
		const sections = [section(1), section(2, T1, { added: true }), section(3, T1, { added: true })];
		const steps = run({ sections });
		const types = stepsOf(steps);
		expect(types[types.length - 2]).toBe('added');
		expect(steps[steps.length - 2]).toEqual({ step: 'added', topicId: T1, chunkIds: [S(2), S(3)] });
		expect(steps.filter((s) => s.step === 'read')).toEqual([{ step: 'read', chunkId: S(1) }]);
	});

	it('has no added step without added sections', () => {
		expect(stepsOf(run({ sections: [section(1)] }))).not.toContain('added');
	});

	it('keeps cards of added sections out of the questions and the mixed quiz', () => {
		// SPEC-GAP: cards of added sections are not named for the normal flow; reading: excluded.
		const added = lcard(2, 'cloze');
		const sections = [section(1), section(2, T1, { added: true })];
		const steps = run({ sections, cards: [lcard(1), lcard(1), lcard(1), added] });
		for (const step of steps) {
			if (step.step === 'questions' || step.step === 'mixedQuiz') {
				expect(step.cardIds).not.toContain(added.id);
			}
		}
	});

	it('orders the whole flow: summary, sections, mixedQuiz, added, summary', () => {
		const sections = [section(1), section(2, T1, { added: true })];
		const steps = run({ sections, cards: [lcard(1), lcard(1), lcard(1)] });
		expect(stepsOf(steps)).toEqual([
			'summary',
			'read',
			'questions',
			'mixedQuiz',
			'added',
			'summary'
		]);
	});

	it('is deterministic and returns a trace array', () => {
		const input = {
			topicId: T1,
			hasSummary: true,
			sections: [section(1)],
			cards: [lcard(1)],
			notes: []
		};
		const a = topicFlow(input);
		expect(topicFlow(input)).toEqual(a);
		expect(Array.isArray(a.trace)).toBe(true);
	});
});
