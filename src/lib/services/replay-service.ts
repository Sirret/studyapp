import type { CardRepo } from '#lib/db/repos/content-repos.ts';
import type { EventRepo } from '#lib/db/repos/event-repo.ts';
import type { KvRepo } from '#lib/db/repos/kv-repo.ts';
import type { Card } from '#lib/db/schemas/card.ts';
import type { CardId } from '#lib/db/schemas/common.ts';
import type { StudyEvent } from '#lib/db/schemas/event.ts';
import { DEFAULT_SETTINGS } from '#lib/db/schemas/kv.ts';
import { DEFAULT_FSRS_CONFIG } from '#lib/engine/fsrs.ts';
import { DEFAULT_REPLAY_CONFIG, replay, type ReplayConfig } from '#lib/engine/replay.ts';
import type { Logger } from '#lib/log/logger.ts';

/** Where replay's settings come from: called before every rebuild, so changes apply at once. */
export type ReplayConfigSource = () => Promise<ReplayConfig>;

/**
 * Reads replay's settings: retention from `kv.settings`, personal weights from `kv.fsrsParams`
 * once optimised, and the device's current time-zone offset (minutes east of UTC).
 *
 * @see BUILD_PLAN §6.1, §6.2 and Decisions log (time-zone offset)
 */
export function kvReplayConfig(kv: KvRepo, tzOffsetMin: () => number): ReplayConfigSource {
	return async () => {
		const [settings, params] = await Promise.all([kv.get('settings'), kv.get('fsrsParams')]);
		return {
			fsrs: {
				...DEFAULT_FSRS_CONFIG,
				retention: (settings ?? DEFAULT_SETTINGS).retention,
				...(params ? { weights: params.params } : {})
			},
			tzOffsetMin: tzOffsetMin()
		};
	};
}

/**
 * Rebuilds the card caches from the event log, the only path that writes them.
 *
 * @see BUILD_PLAN §6.12
 * @see CLAUDE.md rule 5
 */
export class ReplayService {
	constructor(
		private readonly events: EventRepo,
		private readonly cards: CardRepo,
		private readonly logger: Logger,
		private readonly config: ReplayConfigSource = async () => DEFAULT_REPLAY_CONFIG
	) {}

	/** Replays every event over every live card, stores the result, and logs a summary. */
	async rebuildAll(): Promise<void> {
		const [events, cards] = await Promise.all([this.events.list(), this.cards.list()]);
		await this.rebuild(events, cards);
	}

	/** Replays only these cards from their own events, e.g. after an answer or a merge. */
	async rebuildCards(cardIds: readonly CardId[]): Promise<void> {
		const unique = [...new Set(cardIds)];
		const found = await Promise.all(unique.map((id) => this.cards.get(id)));
		const cards = found.filter((card): card is Card => card !== undefined && !card.deleted);
		const events = (await Promise.all(cards.map((card) => this.events.listByCard(card.id)))).flat();
		await this.rebuild(events, cards);
	}

	private async rebuild(events: readonly StudyEvent[], cards: readonly Card[]): Promise<void> {
		const { result, trace } = replay(events, cards, await this.config());
		await this.cards.applyReplay(result);
		this.logger.info('replay', 'rebuilt caches', { cards: cards.length, events: events.length });
		this.logger.debug('replay', 'trace', trace);
	}
}
