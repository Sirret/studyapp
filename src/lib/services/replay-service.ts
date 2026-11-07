import type { CardRepo } from '#lib/db/repos/content-repos.ts';
import type { EventRepo } from '#lib/db/repos/event-repo.ts';
import { replay } from '#lib/engine/replay.ts';
import type { Logger } from '#lib/log/logger.ts';

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
		private readonly logger: Logger
	) {}

	/** Replays every event over every live card, stores the result, and logs a summary. */
	async rebuildAll(): Promise<void> {
		const [events, cards] = await Promise.all([this.events.list(), this.cards.list()]);
		const { result, trace } = replay(events, cards);
		await this.cards.applyReplay(result);
		this.logger.info('replay', 'rebuilt caches', { cards: cards.length, events: events.length });
		this.logger.debug('replay', 'trace', trace);
	}
}
