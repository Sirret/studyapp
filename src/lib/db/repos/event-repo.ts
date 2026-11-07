import type { CardId, DeviceId, SessionId } from '../schemas/common.ts';
import { StudyEventSchema, type NewStudyEvent, type StudyEvent } from '../schemas/event.ts';
import type { SnowpackDb } from '../schema.ts';
import type { DeviceRepo } from './device-repo.ts';

export interface EventRepoDeps {
	clock: () => number;
	newId: () => string;
	device: DeviceRepo;
}

/**
 * The append-only event log. It deliberately has no update or delete: history is only ever added
 * to. Removing a whole course's events belongs to archive and replace import (Phase 9).
 *
 * @see CLAUDE.md rule 5
 * @see DATA_MODEL §3.6
 */
export class EventRepo {
	constructor(
		private readonly db: SnowpackDb,
		private readonly deps: EventRepoDeps
	) {}

	/** Appends one event, assigning its `id`, `ts`, `deviceId` and `seq`. */
	async append(fields: NewStudyEvent): Promise<StudyEvent> {
		const deviceId: DeviceId = await this.deps.device.getDeviceId();
		return this.db.transaction('rw', this.db.events, this.db.kv, async () => {
			const event = StudyEventSchema.parse({
				...fields,
				id: this.deps.newId(),
				ts: this.deps.clock(),
				deviceId,
				seq: await this.deps.device.nextSeq()
			});
			await this.db.events.add(event);
			return event;
		});
	}

	/** Returns every event. Replay imposes its own order. */
	async list(): Promise<StudyEvent[]> {
		return this.db.events.toArray();
	}

	/** Returns one card's events, oldest first. */
	async listByCard(cardId: CardId): Promise<StudyEvent[]> {
		return this.db.events
			.where('[cardId+ts]')
			.between([cardId, -Infinity], [cardId, Infinity])
			.toArray();
	}

	/** Returns one session's events. */
	async listBySession(sessionId: SessionId): Promise<StudyEvent[]> {
		return this.db.events.where('sessionId').equals(sessionId).toArray();
	}
}
