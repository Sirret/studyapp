import type { CardId, ChunkId, ExerciseKind, NoteId, TopicId } from '#lib/db/schemas/common.ts';
import type { NoteType } from '#lib/db/schemas/note.ts';
import {
	LEARN_SECTION_QUESTIONS,
	LOOKBACK_MIN_DISTANCE,
	MEET_TERMS_MAX,
	MEET_TERMS_MIN
} from '#lib/config/defaults.ts';
import { groupOf } from './exercise-kinds.ts';
import { normalizeAnswer } from './grading.ts';
import type { Rng } from './rng.ts';
import type { Traced } from './trace.ts';

/** A section as Learn sees it, in its topic's order. */
export interface LearnSection {
	chunkId: ChunkId;
	topicId: TopicId;
	/** An "Added by the chatbot" section (`chunk.added`): shown last, never a normal section. */
	added: boolean;
	/** Words of reading; 0 = nothing to read. */
	words: number;
}

/** A note as Meet the terms sees it. */
export interface MeetNote {
	id: NoteId;
	chunkId: ChunkId | null;
	type: NoteType;
	/** keyterm term, fact term, or scenario concept (its answer). */
	term: string;
	/** A list fact (`payload.list`). */
	list: boolean;
}

/** A card as Learn sees it. */
export interface LearnCard {
	id: CardId;
	noteId: NoteId;
	topicId: TopicId;
	chunkId: ChunkId | null;
	/** The kind Learn would show (`currentKind`). */
	kind: ExerciseKind;
	/** The latest answer to this card: true/false, or null if never answered. */
	lastCorrect: boolean | null;
	/** When it was last answered (ms), or null. */
	lastSeenAt: number | null;
	/** A diagram or occlusion card: Learn asks it in the topic's `figures` step. */
	figure?: boolean;
}

/** Meet the terms for one section: the term notes and, per term, a same-section scenario. */
export interface MeetTerms {
	noteIds: NoteId[];
	/** Term note → the scenario note whose answer is that term (the "tiny example"). */
	examples: Partial<Record<NoteId, NoteId>>;
}

/** One screen of a topic in Learn. @see SESSION_NOTES §C; PROMPTS §6 */
export type LearnStep =
	| { step: 'summary'; topicId: TopicId; at: 'start' | 'end' }
	| { step: 'meetTerms'; chunkId: ChunkId; terms: MeetTerms }
	| { step: 'read'; chunkId: ChunkId }
	| { step: 'questions'; chunkId: ChunkId; cardIds: CardId[] }
	/** Picked live by `pickLookBack` (it depends on what has been read and answered); may be empty. */
	| { step: 'lookBack'; chunkId: ChunkId }
	/** The topic's diagram and picture cards, after its sections (Decisions "UX fix: figures in Learn"). */
	| { step: 'figures'; topicId: TopicId; cardIds: CardId[] }
	| { step: 'mixedQuiz'; topicId: TopicId; cardIds: CardId[] }
	| { step: 'added'; topicId: TopicId; chunkIds: ChunkId[] };

/**
 * The course's Learn order of sections: topics in their order, each topic's sections in their
 * order, leaving out `added` sections.
 *
 * @see SESSION_NOTES §C; Decisions log "Phase 8.6 Q8" and "Q13"
 */
export function learnOrder(sections: readonly LearnSection[]): ChunkId[] {
	return sections.filter((section) => !section.added).map((section) => section.chunkId);
}

/**
 * Meet the terms for a section: its `keyterm` notes; if none, its non-list `fact` notes; at most
 * `MEET_TERMS_MAX`, in the given order. Each term's example is the first same-section `scenario`
 * note whose term (its answer) equals the term after `normalizeAnswer`. Fewer than
 * `MEET_TERMS_MIN` terms → null (no screen).
 *
 * @see SESSION_NOTES D2; Decisions log "Phase 8.6 Q6"
 */
export function meetTerms(chunkId: ChunkId, notes: readonly MeetNote[]): Traced<MeetTerms | null> {
	const here = notes.filter((note) => note.chunkId === chunkId);
	const keyterms = here.filter((note) => note.type === 'keyterm');
	const source = keyterms.length > 0 ? 'keyterm' : 'fact';
	const pool =
		keyterms.length > 0 ? keyterms : here.filter((note) => note.type === 'fact' && !note.list);
	const terms = pool.slice(0, MEET_TERMS_MAX);
	if (terms.length < MEET_TERMS_MIN) {
		return {
			result: null,
			trace: [{ rule: 'learn.meetTerms.skip', chunkId, terms: terms.length }]
		};
	}
	const scenarios = here.filter((note) => note.type === 'scenario');
	const examples: Partial<Record<NoteId, NoteId>> = {};
	for (const term of terms) {
		const key = normalizeAnswer(term.term);
		const example = scenarios.find((note) => normalizeAnswer(note.term) === key);
		if (example) examples[term.id] = example.id;
	}
	const result = { noteIds: terms.map((note) => note.id), examples };
	return { result, trace: [{ rule: 'learn.meetTerms', chunkId, source, terms: terms.length }] };
}

/**
 * The questions right after a section's reading: `LEARN_SECTION_QUESTIONS` cards, or 1 when the
 * section has at most `LEARN_SECTION_QUESTIONS` cards; recall-group kinds first (§3.3), then the
 * rest, each in the given order. `rest` = the section's other cards, for the mixed quiz.
 *
 * @see SESSION_NOTES §C, §H; Decisions log "Phase 8.6 Q7"
 */
export function sectionQuestions(
	cards: readonly LearnCard[]
): Traced<{ questions: CardId[]; rest: CardId[] }> {
	const count =
		cards.length > LEARN_SECTION_QUESTIONS ? LEARN_SECTION_QUESTIONS : Math.min(1, cards.length);
	const isRecall = (card: LearnCard): boolean => groupOf(card.kind) === 'recall';
	const ranked = [...cards.filter(isRecall), ...cards.filter((card) => !isRecall(card))];
	const questions = ranked.slice(0, count).map((card) => card.id);
	const rest = cards.filter((card) => !questions.includes(card.id)).map((card) => card.id);
	return {
		result: { questions, rest },
		trace: [{ rule: 'learn.sectionQuestions', cards: cards.length, asked: questions.length }]
	};
}

/** Round-robin across lists: the first of each, then the second of each, and so on. */
function interleave<T>(lists: readonly (readonly T[])[]): T[] {
	const out: T[] = [];
	const longest = Math.max(0, ...lists.map((list) => list.length));
	for (let i = 0; i < longest; i += 1) {
		for (const list of lists) {
			const item = list[i];
			if (item !== undefined) out.push(item);
		}
	}
	return out;
}

/** One normal section's steps, and its cards left for the mixed quiz. */
function sectionSteps(
	section: LearnSection,
	index: number,
	cards: readonly LearnCard[],
	notes: readonly MeetNote[]
): { steps: LearnStep[]; rest: CardId[] } {
	const { chunkId } = section;
	const steps: LearnStep[] = [];
	const terms = meetTerms(chunkId, notes).result;
	if (terms) steps.push({ step: 'meetTerms', chunkId, terms });
	if (section.words > 0) steps.push({ step: 'read', chunkId });
	const own = cards.filter((card) => card.chunkId === chunkId);
	const { questions, rest } = sectionQuestions(own).result;
	if (questions.length > 0) steps.push({ step: 'questions', chunkId, cardIds: questions });
	if (index >= LOOKBACK_MIN_DISTANCE) steps.push({ step: 'lookBack', chunkId });
	return { steps, rest };
}

/**
 * A topic's Learn steps: `summary` start (when the topic has one); then per normal section:
 * `meetTerms` (when `meetTerms` gives one), `read` (when `words > 0`), `questions` (when the
 * section has cards), `lookBack` (when the section's index in `order` is ≥ `LOOKBACK_MIN_DISTANCE`);
 * then `figures` with the topic's figure cards in the given order (none → no step; they are in no
 * other step); then `mixedQuiz` with every section's `rest` cards plus the topic's cards with no section,
 * interleaved round-robin across sections (none → no step); then `added` with the topic's added
 * sections (none → no step); then `summary` end (when the topic has one).
 *
 * @see SESSION_NOTES §C; PROMPTS §6 (@summary first and last, @section); Decisions log "Phase 8.6 Q2", "Q7", "Q13"
 */
export function topicFlow(input: {
	topicId: TopicId;
	hasSummary: boolean;
	/** Every section of the course, in topic then section order (for `order`). */
	sections: readonly LearnSection[];
	/** This topic's cards. */
	cards: readonly LearnCard[];
	/** This topic's notes, for Meet the terms. */
	notes: readonly MeetNote[];
}): Traced<LearnStep[]> {
	const { topicId, hasSummary, sections, notes } = input;
	const figures = input.cards.filter((card) => card.figure === true).map((card) => card.id);
	const cards = input.cards.filter((card) => card.figure !== true);
	const order = learnOrder(sections);
	const mine = sections.filter((section) => section.topicId === topicId);
	const normal = mine.filter((section) => !section.added);
	const added = mine.filter((section) => section.added).map((section) => section.chunkId);
	const steps: LearnStep[] = [];
	if (hasSummary) steps.push({ step: 'summary', topicId, at: 'start' });
	const rests: CardId[][] = [];
	for (const section of normal) {
		const part = sectionSteps(section, order.indexOf(section.chunkId), cards, notes);
		steps.push(...part.steps);
		rests.push(part.rest);
	}
	if (figures.length > 0) steps.push({ step: 'figures', topicId, cardIds: figures });
	const loose = cards.filter((card) => card.chunkId === null).map((card) => card.id);
	const quiz = [...interleave(rests), ...loose];
	if (quiz.length > 0) steps.push({ step: 'mixedQuiz', topicId, cardIds: quiz });
	if (added.length > 0) steps.push({ step: 'added', topicId, chunkIds: added });
	if (hasSummary) steps.push({ step: 'summary', topicId, at: 'end' });
	const trace = [
		{
			rule: 'learn.topicFlow',
			topicId,
			sections: normal.length,
			added: added.length,
			figures: figures.length,
			quiz: quiz.length
		}
	];
	return { result: steps, trace };
}

/**
 * The look-back after section `current`: one card from a section at least `LOOKBACK_MIN_DISTANCE`
 * back in `order` **that the student has read in Learn** (`read`). Candidates are ranked: cards
 * whose latest answer was wrong (`lastCorrect === false`) first; then, within a rank, least
 * recently seen first (`lastSeenAt` null counts as oldest). Cards tied at the top (same rank and
 * same `lastSeenAt`) are chosen between with `rng`. No candidate → null.
 *
 * @see SESSION_NOTES §C, §H; Decisions log "Phase 8.6 Q8"
 */
export function pickLookBack(input: {
	order: readonly ChunkId[];
	current: ChunkId;
	read: ReadonlySet<ChunkId>;
	cards: readonly LearnCard[];
	rng: Rng;
}): Traced<CardId | null> {
	const { order, current, read, cards, rng } = input;
	const at = order.indexOf(current);
	const reach = new Set(order.slice(0, Math.max(0, at - LOOKBACK_MIN_DISTANCE + 1)));
	const candidates =
		at < 0
			? []
			: cards.filter((card) => {
					const chunk = card.chunkId;
					return chunk !== null && reach.has(chunk) && read.has(chunk);
				});
	const rank = (card: LearnCard): number => (card.lastCorrect === false ? 0 : 1);
	const seen = (card: LearnCard): number => card.lastSeenAt ?? Number.NEGATIVE_INFINITY;
	const best = candidates.reduce<LearnCard[]>((top, card) => {
		const head = top[0];
		if (!head) return [card];
		const diff = rank(card) - rank(head) || seen(card) - seen(head);
		if (diff < 0) return [card];
		return diff === 0 ? [...top, card] : top;
	}, []);
	const picked = best.length > 1 ? best[Math.floor(rng() * best.length)] : best[0];
	const result = picked?.id ?? null;
	return {
		result,
		trace: [
			{ rule: 'learn.lookBack', current, candidates: candidates.length, tied: best.length, result }
		]
	};
}
