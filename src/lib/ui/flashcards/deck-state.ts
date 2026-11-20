/**
 * The flashcard deck's state: one pass through the cards, each sorted into Still learning or Know
 * it. Never logged (Practice flip; Decisions log "Phase 8.6 Q4"). The keys follow DESIGN §10:
 * Space flips, ← Still learning, → Know it, H hint.
 *
 * @see SESSION_NOTES §C (Practice); DESIGN §8 card-fly, §10 Flashcards
 */

export type DeckVerdict = 'learning' | 'know';
export type DeckKey = 'flip' | 'learning' | 'know' | 'hint';

export interface DeckState {
	/** Card keys in the order shown. */
	order: readonly string[];
	/** Index of the card on top; `order.length` once the pass is done. */
	index: number;
	learning: readonly string[];
	known: readonly string[];
}

/** A fresh pass over the given cards. */
export function startDeck(order: readonly string[]): DeckState {
	return { order: [...order], index: 0, learning: [], known: [] };
}

/** The card on top, or null once the pass is done. */
export function topCard(state: DeckState): string | null {
	return state.order[state.index] ?? null;
}

/** Sorts the top card and moves to the next; does nothing once the pass is done. */
export function rateCard(state: DeckState, verdict: DeckVerdict): DeckState {
	const key = topCard(state);
	if (key === null) return state;
	return {
		...state,
		index: state.index + 1,
		learning: verdict === 'learning' ? [...state.learning, key] : state.learning,
		known: verdict === 'know' ? [...state.known, key] : state.known
	};
}

/** Every card has been sorted. */
export function deckDone(state: DeckState): boolean {
	return state.index >= state.order.length;
}

const KEYS: Readonly<Record<string, DeckKey>> = {
	' ': 'flip',
	ArrowLeft: 'learning',
	ArrowRight: 'know',
	h: 'hint',
	H: 'hint'
};

/** The deck action for a `KeyboardEvent.key`, or null. */
export function deckKey(key: string): DeckKey | null {
	return KEYS[key] ?? null;
}
