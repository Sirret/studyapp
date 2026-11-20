import type { CardId, ExerciseKind } from '#lib/db/schemas/common.ts';
import { groupOf, weightOf } from './exercise-kinds.ts';
import type { Traced } from './trace.ts';

/** A card as Practice sees it, in course card order. */
export interface PracticeCard {
	id: CardId;
	path: readonly ExerciseKind[];
}

/**
 * A kind the quick quiz can ask on its own: not self-rated, not `none`-weight, and not a warm-up
 * kind (matching needs several cards at once, so it is never one card's quiz format).
 *
 * @see Decisions log "Phase 8.6 SPEC-GAP (quick quiz skips warm-up kinds)"
 */
function quizzable(kind: ExerciseKind): boolean {
	const group = groupOf(kind);
	return group !== 'selfRated' && group !== 'warmup' && weightOf(kind) !== 'none';
}

/**
 * The quick quiz: every card once, in the given order, each in one kind of its own path, rotated
 * by the card's position `i` in the input (`usable[i mod usable.length]`, where `usable` = the
 * path without self-rated, warm-up and `none`-weight kinds, so `pathStep` gating is ignored). A
 * card with no usable kind is left out.
 *
 * @see SESSION_NOTES §C, J; Decisions log "Phase 8.6 Q18"
 */
export function quickQuiz(
	cards: readonly PracticeCard[]
): Traced<{ id: CardId; kind: ExerciseKind }[]> {
	const result: { id: CardId; kind: ExerciseKind }[] = [];
	const skipped: CardId[] = [];
	cards.forEach((card, i) => {
		const usable = card.path.filter(quizzable);
		const kind = usable[i % Math.max(usable.length, 1)];
		if (kind === undefined) skipped.push(card.id);
		else result.push({ id: card.id, kind });
	});
	return { result, trace: [{ rule: 'practice.quickQuiz', asked: result.length, skipped }] };
}

/**
 * The cards answered wrong in a quick-quiz round, each once, in the order first missed; they come
 * back once at the round end. Cards answered right later in the round still come back once.
 *
 * @see Decisions log "Phase 8.6 Q18"
 */
export function missesToRetry(answers: readonly { id: CardId; correct: boolean }[]): CardId[] {
	const missed = new Set<CardId>();
	for (const answer of answers) if (!answer.correct) missed.add(answer.id);
	return [...missed];
}

/**
 * The flashcard deck after one pass: the "Still learning" cards, in the order they were swiped,
 * for the next pass; "Know it" cards leave. Never logged, never scored.
 *
 * @see SESSION_NOTES §C ("flip is self-rated and never scored"); Decisions log "Phase 8.6 Q4"
 */
export function nextDeckPass(swipes: readonly { id: CardId; know: boolean }[]): CardId[] {
	return swipes.filter((swipe) => !swipe.know).map((swipe) => swipe.id);
}
