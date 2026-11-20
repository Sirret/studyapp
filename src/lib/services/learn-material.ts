import type { Card } from '#lib/db/schemas/card.ts';
import type { CardId, ChunkId, NoteId } from '#lib/db/schemas/common.ts';
import type { Chunk, Topic } from '#lib/db/schemas/course.ts';
import type { StudyEvent } from '#lib/db/schemas/event.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import { currentKind } from '#lib/engine/exercise-kinds.ts';
import type { LearnCard, LearnSection, LearnStep, MeetNote } from '#lib/engine/learn-flow.ts';
import { isReview } from './study-answer.ts';
import type { AddedSectionView, LearnScreen, MeetTermView } from './learn-types.ts';

/**
 * LearnService's pure parts: the engine inputs built from stored records, and the screens built
 * from the engine's steps.
 *
 * @see SESSION_NOTES §C; Decisions log "Phase 8.6 Q6", "Q8"
 */

/** Sections in Learn order input: topics by `order`, each topic's chunks by `order`. */
export function learnSections(topics: readonly Topic[], chunks: readonly Chunk[]): LearnSection[] {
	return [...topics]
		.sort((a, b) => a.order - b.order)
		.flatMap((topic) =>
			chunks
				.filter((chunk) => chunk.topicId === topic.id)
				.sort((a, b) => a.order - b.order)
				.map((chunk) => ({
					chunkId: chunk.id,
					topicId: topic.id,
					added: chunk.added === true,
					words: chunk.words
				}))
		);
}

/** A card as Learn sees it: its place, its current kind and its latest answer. */
export function learnCards(
	cards: readonly Card[],
	notes: ReadonlyMap<NoteId, Note>,
	events: readonly StudyEvent[]
): LearnCard[] {
	const latest = new Map<CardId, { correct: boolean; ts: number; seq: number }>();
	for (const event of events.filter(isReview)) {
		const seen = latest.get(event.cardId);
		if (!seen || event.seq > seen.seq) {
			latest.set(event.cardId, { correct: event.correct, ts: event.ts, seq: event.seq });
		}
	}
	return cards.flatMap((card) => {
		const note = notes.get(card.noteId);
		if (!note) return [];
		const last = latest.get(card.id);
		return [
			{
				id: card.id,
				noteId: card.noteId,
				topicId: note.topicId,
				chunkId: note.chunkId ?? null,
				kind: currentKind(card.path, card.pathStep, card.accuracy),
				lastCorrect: last?.correct ?? null,
				lastSeenAt: last?.ts ?? null
			}
		];
	});
}

/** The term a note offers Meet the terms, or null for other note types. */
function termOf(note: Note): { term: string; meaning: string; list: boolean } | null {
	switch (note.type) {
		case 'keyterm':
			return { term: note.payload.term, meaning: note.payload.meaning, list: false };
		case 'fact':
			return {
				term: note.payload.term,
				meaning: note.payload.definition,
				list: !!note.payload.list
			};
		case 'scenario':
			return { term: note.payload.answer, meaning: note.payload.situation, list: false };
		default:
			return null;
	}
}

/** The notes Meet the terms can use (keyterm, fact, scenario), in the given order. */
export function meetNotes(notes: readonly Note[]): MeetNote[] {
	return notes.flatMap((note) => {
		const term = termOf(note);
		if (!term) return [];
		const { type } = note;
		return [{ id: note.id, chunkId: note.chunkId ?? null, type, term: term.term, list: term.list }];
	});
}

/** Sections that count as read in Learn: any of their cards has an acquisition review. @see WIP step 6 */
export function readSections(
	cards: readonly LearnCard[],
	events: readonly StudyEvent[]
): Set<ChunkId> {
	const answered = new Set(
		events.filter(isReview).flatMap((e) => (e.mode === 'acquisition' ? [e.cardId] : []))
	);
	return new Set(
		cards.flatMap((card) => (card.chunkId && answered.has(card.id) ? [card.chunkId] : []))
	);
}

/** Everything a screen may show, looked up by id. */
export interface ScreenSource {
	topic: Topic;
	chunks: ReadonlyMap<ChunkId, Chunk>;
	notes: ReadonlyMap<NoteId, Note>;
	cards: readonly LearnCard[];
}

function meetTermView(source: ScreenSource, noteId: NoteId, exampleId?: NoteId): MeetTermView[] {
	const note = source.notes.get(noteId);
	const term = note && termOf(note);
	if (!term) return [];
	const example = exampleId ? source.notes.get(exampleId) : undefined;
	const situation = example?.type === 'scenario' ? example.payload.situation : null;
	return [{ noteId, term: term.term, meaning: term.meaning, example: situation }];
}

function readScreen(source: ScreenSource, chunkId: ChunkId): LearnScreen {
	const chunk = source.chunks.get(chunkId);
	const terms = [...source.notes.values()].flatMap((note) =>
		note.chunkId === chunkId && (note.type === 'keyterm' || note.type === 'fact')
			? [note.payload.term]
			: []
	);
	return {
		step: 'read',
		chunkId,
		title: chunk?.title ?? null,
		text: chunk?.text ?? '',
		tip: chunk?.tip ?? null,
		terms,
		generated: chunk?.source === 'generated',
		session: false
	};
}

function addedSection(source: ScreenSource, chunkId: ChunkId): AddedSectionView {
	const chunk = source.chunks.get(chunkId);
	const cardIds = source.cards.filter((c) => c.chunkId === chunkId).map((c) => c.id);
	return { chunkId, title: chunk?.title ?? null, text: chunk?.text ?? '', cardIds };
}

/** The screen for one engine step. */
export function screenOf(source: ScreenSource, step: LearnStep): LearnScreen {
	switch (step.step) {
		case 'summary':
			return { step: 'summary', at: step.at, text: source.topic.summary ?? '', session: false };
		case 'meetTerms': {
			const { noteIds, examples } = step.terms;
			const terms = noteIds.flatMap((id) => meetTermView(source, id, examples[id]));
			return { step: 'meetTerms', chunkId: step.chunkId, terms, session: true };
		}
		case 'read':
			return readScreen(source, step.chunkId);
		case 'questions':
			return {
				step: 'questions',
				chunkId: step.chunkId,
				cards: step.cardIds.length,
				session: true
			};
		case 'lookBack':
			return { step: 'lookBack', chunkId: step.chunkId, session: true };
		case 'mixedQuiz':
			return { step: 'mixedQuiz', cards: step.cardIds.length, session: true };
		case 'added':
			return {
				step: 'added',
				sections: step.chunkIds.map((id) => addedSection(source, id)),
				session: false
			};
	}
}
