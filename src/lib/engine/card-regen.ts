import type { CardId } from '#lib/db/schemas/common.ts';
import type { Card } from '#lib/db/schemas/card.ts';
import { generateCards, type CardSpec, type NoteContent } from './cardgen.ts';
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

function samePath(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((kind, i) => kind === b[i]);
}

/**
 * Matches the cards an edited note should have (`generateCards`) to its stored cards by `variant`,
 * so an edit keeps card IDs and history (CLAUDE.md rule 7). Pure; writes nothing.
 *
 * @see DATA_MODEL §3.5 (`variant` is unique per note)
 * @see BUILD_PLAN §10 row 8.5
 */
export function planCardRegen(
	note: NoteContent,
	existing: readonly ExistingCard[]
): Traced<CardRegenPlan> {
	const { result: specs, trace } = generateCards(note);
	const byVariant = new Map(existing.map((card) => [card.variant, card]));
	const plan: CardRegenPlan = { keep: [], add: [], remove: [] };
	for (const spec of specs) {
		const stored = byVariant.get(spec.variant);
		if (stored === undefined) {
			plan.add.push({ variant: spec.variant, path: [...spec.path] });
			continue;
		}
		plan.keep.push({
			cardId: stored.id,
			variant: spec.variant,
			path: [...spec.path],
			pathChanged: !samePath(stored.path, spec.path)
		});
	}
	const wanted = new Set(specs.map((spec) => spec.variant));
	plan.remove = existing.filter((card) => !wanted.has(card.variant)).map((card) => card.id);
	trace.push({
		rule: 'regen-by-variant',
		kept: plan.keep.length,
		added: plan.add.length,
		removed: plan.remove.length,
		pathChanged: plan.keep.filter((k) => k.pathChanged).length
	});
	return { result: plan, trace };
}
