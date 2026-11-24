import type { CardId } from '#lib/db/schemas/common.ts';
import type { Card } from '#lib/db/schemas/card.ts';
import { generateCards, type CardSpec, type NoteContent } from './cardgen.ts';
import type { Traced } from './trace.ts';

/** A stored card as card regeneration reads it; a tombstone carries `deleted: true`. */
export type ExistingCard = Pick<Card, 'id' | 'variant' | 'path'> & Partial<Pick<Card, 'deleted'>>;

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
	/** Tombstoned cards whose variant is back (an occlusion box named again): restored, same ID. */
	revive: KeptCard[];
	/** Variants the note gained: new cards. */
	add: CardSpec[];
	/** Variants the note lost: these cards are tombstoned (their events stay). */
	remove: CardId[];
}

function samePath(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((kind, i) => kind === b[i]);
}

/**
 * Only occlusion variants (`box:<boxId>`) name a fixed thing, so only they come back from a
 * tombstone; positional variants (cloze `c2`, sequence steps) may mean different content later.
 */
function revivable(note: NoteContent): boolean {
	return note.type === 'occlusion';
}

function keptCard(stored: ExistingCard, spec: CardSpec): KeptCard {
	return {
		cardId: stored.id,
		variant: spec.variant,
		path: [...spec.path],
		pathChanged: !samePath(stored.path, spec.path)
	};
}

/**
 * Matches the cards an edited note should have (`generateCards`) to its stored cards by `variant`,
 * so an edit keeps card IDs and history (CLAUDE.md rule 7). Pure; writes nothing. `existing` may
 * include tombstones: an occlusion box whose label was cleared (its card tombstoned) and is named
 * again gets its old card back (`revive`), so its history carries on (Decisions log
 * "Occlusion relabel keeps the card"). Other tombstones are ignored.
 *
 * @see DATA_MODEL §3.5 (`variant` is unique per note)
 * @see BUILD_PLAN §10 row 8.5
 */
export function planCardRegen(
	note: NoteContent,
	existing: readonly ExistingCard[]
): Traced<CardRegenPlan> {
	const { result: specs, trace } = generateCards(note);
	const live = existing.filter((card) => card.deleted !== true);
	const byVariant = new Map(live.map((card) => [card.variant, card]));
	const tombstones = new Map(
		revivable(note) ? existing.filter((c) => c.deleted === true).map((c) => [c.variant, c]) : []
	);
	const plan: CardRegenPlan = { keep: [], revive: [], add: [], remove: [] };
	for (const spec of specs) {
		const stored = byVariant.get(spec.variant);
		const buried = stored ? undefined : tombstones.get(spec.variant);
		if (stored) plan.keep.push(keptCard(stored, spec));
		else if (buried) plan.revive.push(keptCard(buried, spec));
		else plan.add.push({ variant: spec.variant, path: [...spec.path] });
	}
	const wanted = new Set(specs.map((spec) => spec.variant));
	plan.remove = live.filter((card) => !wanted.has(card.variant)).map((card) => card.id);
	trace.push({
		rule: 'regen-by-variant',
		kept: plan.keep.length,
		revived: plan.revive.length,
		added: plan.add.length,
		removed: plan.remove.length,
		pathChanged: plan.keep.filter((k) => k.pathChanged).length
	});
	return { result: plan, trace };
}
