import type { CardId } from '#lib/db/schemas/common.ts';
import type { Card } from '#lib/db/schemas/card.ts';
import type { CardSpec, NoteContent } from './cardgen.ts';
import type { Traced } from './trace.ts';

/** A stored card as card regeneration reads it. */
export type ExistingCard = Pick<Card, 'id' | 'variant' | 'path'>;

/** A card that stays: same ID (so its history survives), maybe with a new path. */
export interface KeptCard {
	cardId: CardId;
	variant: string;
	path: CardSpec['path'];
	/** Its path differs from the stored one; its caches must be replayed. */
	pathChanged: boolean;
}

/** What an edited note does to its cards. */
export interface CardRegenPlan {
	/** Variants the edited note still has: the stored card keeps its ID. */
	keep: KeptCard[];
	/** Variants the note gained: new cards. */
	add: CardSpec[];
	/** Variants the note lost: these cards are tombstoned (their events stay). */
	remove: CardId[];
}

/**
 * Matches the cards an edited note should have (`generateCards`) to its stored cards by `variant`,
 * so an edit keeps card IDs and history (CLAUDE.md rule 7). Pure; writes nothing.
 *
 * @see DATA_MODEL §3.5 (`variant` is unique per note)
 * @see BUILD_PLAN §10 row 8.5
 */
export function planCardRegen(
	_note: NoteContent,
	_existing: readonly ExistingCard[]
): Traced<CardRegenPlan> {
	throw new Error('not implemented');
}
