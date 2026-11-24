import type { CourseId, SessionId } from '../schemas/common.ts';
import { SessionSchema, type Session } from '../schemas/session.ts';
import type { SnowpackDb } from '../schema.ts';

/**
 * Local session records, including the snapshot saved after every answer. Not content: sessions
 * never merge or export, so there is no `updatedAt` or tombstone.
 *
 * @see DATA_MODEL §3.7
 */
export class SessionRepo {
	constructor(private readonly db: SnowpackDb) {}

	/** Creates or replaces a session. */
	async save(session: Session): Promise<void> {
		await this.db.sessions.put(SessionSchema.parse(session));
	}

	/** Returns a session, or `undefined` if there is none. */
	async get(id: SessionId): Promise<Session | undefined> {
		return this.db.sessions.get(id);
	}

	/** When each course was last in a session that started: the latest `startedAt` per course. */
	async lastStartedByCourse(): Promise<Map<CourseId, number>> {
		const latest = new Map<CourseId, number>();
		await this.db.sessions.each((session) => {
			for (const id of session.courseIds) {
				latest.set(id, Math.max(latest.get(id) ?? 0, session.startedAt));
			}
		});
		return latest;
	}
}
