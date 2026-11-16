import type { CardId, ChunkId, ExerciseKind, NoteId, TopicId } from '#lib/db/schemas/common.ts';
import type { NoteType } from '#lib/db/schemas/note.ts';
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
	| { step: 'mixedQuiz'; topicId: TopicId; cardIds: CardId[] }
	| { step: 'added'; topicId: TopicId; chunkIds: ChunkId[] };

/**
 * The course's Learn order of sections: topics in their order, each topic's sections in their
 * order, leaving out `added` sections.
 *
 * @see SESSION_NOTES §C; Decisions log "Phase 8.6 Q8" and "Q13"
 */
export function learnOrder(_sections: readonly LearnSection[]): ChunkId[] {
	throw new Error('not implemented');
}

/**
 * Meet the terms for a section: its `keyterm` notes; if none, its non-list `fact` notes; at most
 * `MEET_TERMS_MAX`, in the given order. Each term's example is the first same-section `scenario`
 * note whose term (its answer) equals the term after `normalizeAnswer`. Fewer than
 * `MEET_TERMS_MIN` terms → null (no screen).
 *
 * @see SESSION_NOTES D2; Decisions log "Phase 8.6 Q6"
 */
export function meetTerms(
	_chunkId: ChunkId,
	_notes: readonly MeetNote[]
): Traced<MeetTerms | null> {
	throw new Error('not implemented');
}

/**
 * The questions right after a section's reading: `LEARN_SECTION_QUESTIONS` cards, or 1 when the
 * section has at most `LEARN_SECTION_QUESTIONS` cards; recall-group kinds first (§3.3), then the
 * rest, each in the given order. `rest` = the section's other cards, for the mixed quiz.
 *
 * @see SESSION_NOTES §C, §H; Decisions log "Phase 8.6 Q7"
 */
export function sectionQuestions(
	_cards: readonly LearnCard[]
): Traced<{ questions: CardId[]; rest: CardId[] }> {
	throw new Error('not implemented');
}

/**
 * A topic's Learn steps: `summary` start (when the topic has one); then per normal section:
 * `meetTerms` (when `meetTerms` gives one), `read` (when `words > 0`), `questions` (when the
 * section has cards), `lookBack` (when the section's index in `order` is ≥ `LOOKBACK_MIN_DISTANCE`);
 * then `mixedQuiz` with every section's `rest` cards plus the topic's cards with no section,
 * interleaved round-robin across sections (none → no step); then `added` with the topic's added
 * sections (none → no step); then `summary` end (when the topic has one).
 *
 * @see SESSION_NOTES §C; PROMPTS §6 (@summary first and last, @section); Decisions log "Phase 8.6 Q2", "Q7", "Q13"
 */
export function topicFlow(_input: {
	topicId: TopicId;
	hasSummary: boolean;
	/** Every section of the course, in topic then section order (for `order`). */
	sections: readonly LearnSection[];
	/** This topic's cards. */
	cards: readonly LearnCard[];
	/** This topic's notes, for Meet the terms. */
	notes: readonly MeetNote[];
}): Traced<LearnStep[]> {
	throw new Error('not implemented');
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
export function pickLookBack(_input: {
	order: readonly ChunkId[];
	current: ChunkId;
	read: ReadonlySet<ChunkId>;
	cards: readonly LearnCard[];
	rng: Rng;
}): Traced<CardId | null> {
	throw new Error('not implemented');
}
