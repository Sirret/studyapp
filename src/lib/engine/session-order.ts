import type { CardId, ExerciseKind, NoteId } from '#lib/db/schemas/common.ts';
import type { ReviewEvent } from '#lib/db/schemas/event.ts';
import type { NoteType } from '#lib/db/schemas/note.ts';
import { confusionCounts } from './distractors.ts';
import { PHASE_KIND_ORDER } from './exercise-kinds.ts';

/** What ordering needs of a planned card. */
export interface OrderCard {
	id: CardId;
	noteId: NoteId;
	noteType: NoteType;
	kind: ExerciseKind;
}

type ConfusionEvents = readonly Pick<ReviewEvent, 'cardId' | 'chosenFromCardId'>[];

/**
 * Groups cards by kind in `PHASE_KIND_ORDER`, keeping input order within a kind.
 *
 * @see BUILD_PLAN §6.4 and Decisions log (session phases)
 */
export function byKind<T extends OrderCard>(cards: readonly T[]): T[] {
	const rank = (card: T) => PHASE_KIND_ORDER.indexOf(card.kind);
	return [...cards].sort((a, b) => rank(a) - rank(b));
}

function isSameCompare(a: OrderCard, b: OrderCard): boolean {
	return a.noteType === 'compare' && b.noteType === 'compare' && a.noteId === b.noteId;
}

/** The remaining card most confusable with `last`, or -1 when none is confusable. */
function closestIndex(
	last: OrderCard,
	remaining: readonly OrderCard[],
	events: ConfusionEvents
): number {
	const confusions = confusionCounts(events, last.id);
	let best = -1;
	let bestScore: [number, number] = [0, 0];
	remaining.forEach((card, index) => {
		const score: [number, number] = [
			confusions.get(card.id) ?? 0,
			isSameCompare(last, card) ? 1 : 0
		];
		const better =
			score[0] > bestScore[0] || (score[0] === bestScore[0] && score[1] > bestScore[1]);
		if (better) [best, bestScore] = [index, score];
	});
	return best;
}

/**
 * Chains confusable cards next to each other (most confusion events, then same compare note),
 * otherwise keeping the given order.
 *
 * @see BUILD_PLAN §6.4 (discrimination)
 */
export function chainConfusables<T extends OrderCard>(
	cards: readonly T[],
	events: ConfusionEvents
): T[] {
	const remaining = [...cards];
	const chained: T[] = [];
	let last = remaining.shift();
	while (last) {
		chained.push(last);
		const next = closestIndex(last, remaining, events);
		last = next === -1 ? remaining.shift() : remaining.splice(next, 1)[0];
	}
	return chained;
}

/** The first entry for each card ID. @see Decisions log (session phases) */
export function uniqueById<T extends { id: CardId }>(cards: readonly T[]): T[] {
	const seen = new Set<CardId>();
	return cards.filter((card) => !seen.has(card.id) && seen.add(card.id));
}
