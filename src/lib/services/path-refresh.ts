import { CARD_PATHS_VERSION } from '#lib/config/defaults.ts';
import type { ContentStore } from '#lib/db/repos/content-store.ts';
import type { KvRepo } from '#lib/db/repos/kv-repo.ts';
import type { Card } from '#lib/db/schemas/card.ts';
import type { CardId, NoteId } from '#lib/db/schemas/common.ts';
import { planCardRegen } from '#lib/engine/card-regen.ts';
import type { NoteContent } from '#lib/engine/cardgen.ts';
import type { Logger } from '#lib/log/logger.ts';
import type { ReplayService } from './replay-service.ts';

const LOG_AREA = 'cards';

export interface PathRefreshDeps {
	kv: Pick<KvRepo, 'get' | 'set'>;
	store: Pick<ContentStore, 'notes' | 'cards' | 'putBatch' | 'getDeviceId'>;
	replay: Pick<ReplayService, 'rebuildCards'>;
	logger: Logger;
}

function byNote(cards: readonly Card[]): Map<NoteId, Card[]> {
	const out = new Map<NoteId, Card[]>();
	for (const card of cards) out.set(card.noteId, [...(out.get(card.noteId) ?? []), card]);
	return out;
}

/**
 * Brings stored cards onto the exercise paths `generateCards` gives now (Phase 8.6: list facts
 * and facts with key words got new paths), once per `CARD_PATHS_VERSION`. Only the `path` of a
 * kept card changes: card IDs stay (matched by variant, rule 7), no card is added or removed, and
 * no event is touched; changed cards are replayed so their caches follow the new path (rule 5).
 * Returns the number of cards whose path changed.
 *
 * @see WIP step 4 / Decisions log "Phase 8.6 Q19"; engine/card-regen.ts
 */
export async function refreshCardPaths(deps: PathRefreshDeps): Promise<number> {
	if (((await deps.kv.get('cardPathsVersion')) ?? 0) >= CARD_PATHS_VERSION) return 0;
	const [notes, cards] = await Promise.all([deps.store.notes.list(), deps.store.cards.list()]);
	const cardsOf = byNote(cards);
	const deviceId = await deps.store.getDeviceId();
	const changed: Card[] = [];
	let skipped = 0;
	for (const note of notes) {
		const existing = cardsOf.get(note.id) ?? [];
		const { result: plan } = planCardRegen(note as NoteContent, existing);
		skipped += plan.add.length + plan.remove.length;
		for (const kept of plan.keep.filter((k) => k.pathChanged)) {
			const card = existing.find((candidate) => candidate.id === kept.cardId);
			if (card) changed.push(deps.store.cards.draftChange(card, { path: kept.path }, deviceId));
		}
	}
	if (changed.length > 0) {
		await deps.store.putBatch({ cards: changed });
		await deps.replay.rebuildCards(changed.map((card): CardId => card.id));
	}
	await deps.kv.set('cardPathsVersion', CARD_PATHS_VERSION);
	deps.logger.info(LOG_AREA, 'card paths refreshed', { changed: changed.length, skipped });
	return changed.length;
}
