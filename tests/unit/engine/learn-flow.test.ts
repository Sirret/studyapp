import { describe, expect, it } from 'vitest';
import { LEARN_SECTION_QUESTIONS, MEET_TERMS_MAX, MEET_TERMS_MIN } from '#lib/config/defaults.ts';
import type { ExerciseKind } from '#lib/db/schemas/common.ts';
import {
	learnOrder,
	meetTerms,
	sectionQuestions,
	type LearnCard,
	type LearnSection,
	type MeetNote
} from '#lib/engine/learn-flow.ts';
import { cardId, chunkId, deepFreeze, noteId, topicId } from './fixtures.ts';

/**
 * The Learn door: section order, Meet the terms, section questions and a topic's steps.
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

describe('learnOrder', () => {
	it('lists sections in the given topic then section order', () => {
		const sections = [section(1, T1), section(2, T1), section(3, T2), section(4, T2)];
		expect(learnOrder(sections)).toEqual([S(1), S(2), S(3), S(4)]);
	});

	it('leaves out added sections', () => {
		const sections = [section(1), section(2, T1, { added: true }), section(3)];
		expect(learnOrder(sections)).toEqual([S(1), S(3)]);
	});

	it('is empty for no sections', () => {
		expect(learnOrder([])).toEqual([]);
	});
});

describe('meetTerms', () => {
	it('uses the section keyterm notes', () => {
		const notes = [note(1, 'keyterm', 'tcp'), note(2, 'keyterm', 'udp'), note(3, 'fact', 'icmp')];
		const { result } = meetTerms(S(1), notes);
		expect(result?.noteIds).toEqual([noteId(1), noteId(2)]);
	});

	it('falls back to the non-list fact notes when the section has no keyterm', () => {
		const notes = [
			note(1, 'fact', 'tcp'),
			note(2, 'fact', 'udp', { list: true }),
			note(3, 'fact', 'icmp'),
			note(4, 'cloze', 'ignored')
		];
		expect(meetTerms(S(1), notes).result?.noteIds).toEqual([noteId(1), noteId(3)]);
	});

	it('uses at most MEET_TERMS_MAX terms, in the given order', () => {
		const notes = Array.from({ length: MEET_TERMS_MAX + 2 }, (_x, i) =>
			note(i + 1, 'keyterm', `t${i}`)
		);
		const ids = meetTerms(S(1), notes).result?.noteIds;
		expect(ids).toEqual(notes.slice(0, MEET_TERMS_MAX).map((n) => n.id));
	});

	it('is null (no screen) with fewer than MEET_TERMS_MIN terms', () => {
		const notes = Array.from({ length: MEET_TERMS_MIN - 1 }, (_x, i) =>
			note(i + 1, 'keyterm', `t${i}`)
		);
		expect(meetTerms(S(1), notes).result).toBeNull();
		expect(meetTerms(S(1), []).result).toBeNull();
	});

	it('shows the screen at exactly MEET_TERMS_MIN terms', () => {
		const notes = Array.from({ length: MEET_TERMS_MIN }, (_x, i) =>
			note(i + 1, 'keyterm', `t${i}`)
		);
		expect(meetTerms(S(1), notes).result?.noteIds).toHaveLength(MEET_TERMS_MIN);
	});

	it('ignores notes of other sections and notes with no section', () => {
		const notes = [
			note(1, 'keyterm', 'tcp'),
			note(2, 'keyterm', 'udp', { chunkId: S(2) }),
			note(3, 'keyterm', 'icmp', { chunkId: null })
		];
		expect(meetTerms(S(1), notes).result).toBeNull();
	});

	it('does not fall back to facts when the section has any keyterm (SPEC-GAP: one keyterm + facts)', () => {
		// SPEC-GAP: "its keyterm notes; if none, its non-list fact notes". Reading: one keyterm is
		// "some", so the facts are not used and a single term means no screen.
		const notes = [note(1, 'keyterm', 'tcp'), note(2, 'fact', 'udp'), note(3, 'fact', 'icmp')];
		expect(meetTerms(S(1), notes).result).toBeNull();
	});

	it('gives each term the first same-section scenario whose answer is the term (normalised)', () => {
		const notes = [
			note(1, 'keyterm', 'TCP'),
			note(2, 'keyterm', 'udp'),
			note(3, 'scenario', ' tcp. '),
			note(4, 'scenario', 'tcp'),
			note(5, 'scenario', 'udp', { chunkId: S(2) })
		];
		const terms = meetTerms(S(1), notes).result;
		expect(terms?.examples).toEqual({ [noteId(1)]: noteId(3) });
	});

	it('has no example entry for a term without a matching scenario', () => {
		const notes = [note(1, 'keyterm', 'tcp'), note(2, 'keyterm', 'udp')];
		expect(meetTerms(S(1), notes).result?.examples).toEqual({});
	});

	it('is deterministic and returns a trace array', () => {
		const notes = [note(1, 'keyterm', 'tcp'), note(2, 'keyterm', 'udp')];
		const a = meetTerms(S(1), notes);
		expect(meetTerms(S(1), notes)).toEqual(a);
		expect(Array.isArray(a.trace)).toBe(true);
	});
});

describe('sectionQuestions', () => {
	it('asks LEARN_SECTION_QUESTIONS cards when the section has more cards than that', () => {
		const cards = Array.from({ length: LEARN_SECTION_QUESTIONS + 2 }, () => lcard(1));
		const { result } = sectionQuestions(cards);
		expect(result.questions).toHaveLength(LEARN_SECTION_QUESTIONS);
		expect(result.rest).toHaveLength(2);
	});

	it('asks one card when the section has at most LEARN_SECTION_QUESTIONS cards', () => {
		const cards = Array.from({ length: LEARN_SECTION_QUESTIONS }, () => lcard(1));
		const { result } = sectionQuestions(cards);
		expect(result.questions).toHaveLength(1);
		expect(result.rest).toHaveLength(LEARN_SECTION_QUESTIONS - 1);
	});

	it('handles one card and no cards', () => {
		const one = lcard(1);
		expect(sectionQuestions([one]).result).toEqual({ questions: [one.id], rest: [] });
		expect(sectionQuestions([]).result).toEqual({ questions: [], rest: [] });
	});

	it('puts recall-group kinds first, then the rest in the given order', () => {
		const a = lcard(1, 'mc');
		const b = lcard(1, 'mc');
		const recall = lcard(1, 'cloze');
		const { result } = sectionQuestions([a, b, recall]);
		expect(result.questions).toEqual([recall.id, a.id].slice(0, LEARN_SECTION_QUESTIONS));
		expect(result.rest).toEqual([b.id]);
	});

	it('keeps the given order among cards of the same group', () => {
		const r1 = lcard(1, 'cloze');
		const m1 = lcard(1, 'mc');
		const r2 = lcard(1, 'ideaUnit');
		const r3 = lcard(1, 'listAll');
		const { result } = sectionQuestions([r1, m1, r2, r3]);
		expect(result.questions).toEqual([r1.id, r2.id]);
		expect(result.rest).toEqual([m1.id, r3.id]);
	});

	it('property-style: questions and rest partition the cards without repeats', () => {
		const cards = [
			lcard(1, 'mc'),
			lcard(1, 'cloze'),
			lcard(1, 'whichOne'),
			lcard(1, 'mc'),
			lcard(1, 'listN')
		];
		const { result } = sectionQuestions(cards);
		expect([...result.questions, ...result.rest].sort()).toEqual(cards.map((x) => x.id).sort());
	});

	it('is deterministic, does not change its input and returns a trace array', () => {
		const cards = deepFreeze([lcard(1), lcard(1), lcard(1)]);
		const a = sectionQuestions(cards);
		expect(sectionQuestions(cards)).toEqual(a);
		expect(Array.isArray(a.trace)).toBe(true);
	});
});
