import type { CardId, ChunkId, CourseId, NoteId, TopicId } from '#lib/db/schemas/common.ts';

/**
 * What the Learn screen (`/course/[id]/learn`) shows: the in-scope topics, and one topic's flow
 * as a list of screens. Session steps are started with `LearnService.startStep`.
 *
 * @see SESSION_NOTES §C; PROMPTS §6; Decisions log "Phase 8.6 Q2", "Q6", "Q7", "Q8", "Q13"
 */

/** A topic Learn can open. */
export interface LearnTopicView {
	id: TopicId;
	name: string;
	/** Normal (not added) in-scope sections. */
	sections: number;
	/** In-scope studyable cards. */
	cards: number;
}

/** One term of Meet the terms, with its tiny example when a same-section scenario names it. */
export interface MeetTermView {
	noteId: NoteId;
	term: string;
	meaning: string;
	example: string | null;
}

/** An "Added by the chatbot" section: its title and its cards, for keep/delete. */
export interface AddedSectionView {
	chunkId: ChunkId;
	title: string | null;
	text: string;
	cardIds: CardId[];
}

/** One screen of a topic's flow. Steps with `session: true` start a session through `startStep`. */
export type LearnScreen =
	| { step: 'summary'; at: 'start' | 'end'; text: string; session: false }
	| { step: 'meetTerms'; chunkId: ChunkId; terms: MeetTermView[]; session: true }
	| {
			step: 'read';
			chunkId: ChunkId;
			title: string | null;
			text: string;
			tip: string | null;
			/** Section terms the reader underlines (KeyTerm). */
			terms: string[];
			generated: boolean;
			session: false;
	  }
	| { step: 'questions'; chunkId: ChunkId; cards: number; session: true }
	| { step: 'lookBack'; chunkId: ChunkId; session: true }
	| { step: 'mixedQuiz'; cards: number; session: true }
	| { step: 'added'; sections: AddedSectionView[]; session: false };

/** A topic's whole Learn flow. */
export interface LearnFlowView {
	courseId: CourseId;
	topic: { id: TopicId; name: string };
	screens: LearnScreen[];
}
