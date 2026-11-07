import type { CardId, ExerciseKind, NoteId } from '#lib/db/schemas/common.ts';
import type { ReviewEvent } from '#lib/db/schemas/event.ts';
import type { NoteType } from '#lib/db/schemas/note.ts';
import type { SessionPhase, SessionSnapshot } from '#lib/db/schemas/session.ts';
import type { Traced } from './trace.ts';

/** A card chosen for a session, with what the caller already worked out about it. */
export interface PlanCard {
	id: CardId;
	noteId: NoteId;
	noteType: NoteType;
	/** The kind it will be shown as (`currentKind`). */
	kind: ExerciseKind;
	/** Never reviewed before. */
	isNew: boolean;
	/** Counting corrects needed this session (`requiredCorrects`). */
	required: number;
}

/** Cards in the caller's priority order, plus the events that log confusions between cards. */
export interface PlanInput {
	cards: readonly PlanCard[];
	confusionEvents: readonly Pick<ReviewEvent, 'cardId' | 'chosenFromCardId'>[];
}

/**
 * The phase a card belongs in: warm-up kinds → `warmup`; new cards, `exampleStudy` and `fadeStep`
 * → `new`; Sort & discriminate kinds → `discrimination`; everything else → `recall`.
 *
 * @see BUILD_PLAN §6.4 and Decisions log (session phases)
 */
export function phaseFor(kind: ExerciseKind, isNew: boolean): SessionPhase {
	void kind;
	void isNew;
	throw new Error('not implemented');
}

/**
 * Builds the opening snapshot: phases in order warm-up → new → recall → discrimination, cards
 * grouped by kind (`PHASE_KIND_ORDER`) within a phase keeping input order, and confusable cards
 * (same compare note, or a logged confusion) adjacent in discrimination. A repeated card ID keeps
 * its first entry.
 *
 * @see BUILD_PLAN §6.4 and Decisions log (session phases)
 */
export function planSession(input: PlanInput): Traced<SessionSnapshot> {
	void input;
	throw new Error('not implemented');
}

/**
 * Starts cleanup once the main queue is empty: every card that failed this session comes back
 * once, lowest retrievability first (ties by card ID), needing one more counting correct. Sets
 * `cleanup`, so it happens once. Returns the state unchanged if the queue isn't empty or cleanup
 * already ran.
 *
 * @see CONCEPT §6 and Decisions log (session phases)
 */
export function startCleanup(
	state: SessionSnapshot,
	retrievability: Readonly<Record<CardId, number>>
): Traced<SessionSnapshot> {
	void state;
	void retrievability;
	throw new Error('not implemented');
}

/** The phase of the current card, or `cleanup` when the queue is empty. @see DATA_MODEL §3.7 */
export function sessionPhase(state: SessionSnapshot): SessionPhase {
	void state;
	throw new Error('not implemented');
}

/** Whether the session has nothing left: queue empty and cleanup done. @see BUILD_PLAN §6.4 */
export function isSessionComplete(state: SessionSnapshot): boolean {
	void state;
	throw new Error('not implemented');
}
