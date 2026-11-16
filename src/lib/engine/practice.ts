import type { CardId, ExerciseKind } from '#lib/db/schemas/common.ts';
import type { Traced } from './trace.ts';

/** A card as Practice sees it, in course card order. */
export interface PracticeCard {
	id: CardId;
	path: readonly ExerciseKind[];
}

/**
 * The quick quiz: every card once, in the given order, each in one kind of its own path, rotated
 * by position (`path[i mod usable.length]`, where `usable` = the path without self-rated and
 * `none`-weight kinds, so `pathStep` gating is ignored). A card with no usable kind is left out.
 *
 * @see SESSION_NOTES §C, J; Decisions log "Phase 8.6 Q18"
 */
export function quickQuiz(
	_cards: readonly PracticeCard[]
): Traced<{ id: CardId; kind: ExerciseKind }[]> {
	throw new Error('not implemented');
}

/**
 * The cards answered wrong in a quick-quiz round, each once, in the order first missed; they come
 * back once at the round end. Cards answered right later in the round still come back once.
 *
 * @see Decisions log "Phase 8.6 Q18"
 */
export function missesToRetry(_answers: readonly { id: CardId; correct: boolean }[]): CardId[] {
	throw new Error('not implemented');
}

/**
 * The flashcard deck after one pass: the "Still learning" cards, in the order they were swiped,
 * for the next pass; "Know it" cards leave. Never logged, never scored.
 *
 * @see SESSION_NOTES §C ("flip is self-rated and never scored"); Decisions log "Phase 8.6 Q4"
 */
export function nextDeckPass(_swipes: readonly { id: CardId; know: boolean }[]): CardId[] {
	throw new Error('not implemented');
}
