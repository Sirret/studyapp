import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import { afterEach, expect, it } from 'vitest';
import { CardRepo } from '#lib/db/repos/content-repos.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { EventRepo } from '#lib/db/repos/event-repo.ts';
import { createDb } from '#lib/db/schema.ts';
import type { CourseId, NoteId, SessionId } from '#lib/db/schemas/common.ts';
import type { NewLogEntry } from '#lib/db/schemas/log-entry.ts';
import { Logger } from '#lib/log/logger.ts';
import { ReplayService } from '#lib/services/replay-service.ts';

const db = createDb('replay-service-test');

afterEach(async () => {
	await db.delete();
});

it('rebuilds card caches from the event log and logs a summary', async () => {
	const device = new DeviceRepo(db, randomUUID);
	const clock = () => 1_000;
	const cards = new CardRepo(db, {
		clock,
		newId: randomUUID,
		getDeviceId: () => device.getDeviceId()
	});
	const events = new EventRepo(db, { clock, newId: randomUUID, device });
	const logged: NewLogEntry[] = [];
	const logger = new Logger({
		sink: { append: async (entry) => void logged.push(entry) },
		clock
	});

	const card = await cards.create({
		noteId: randomUUID() as NoteId,
		courseId: randomUUID() as CourseId,
		variant: 'fwd',
		path: ['cloze'],
		suspended: false
	});
	await events.append({
		type: 'review',
		cardId: card.id,
		sessionId: randomUUID() as SessionId,
		mode: 'longterm',
		kind: 'cloze',
		weight: 'full',
		firstAttempt: true,
		correct: true,
		responseMs: 10,
		credited: true
	});

	await new ReplayService(events, cards, logger).rebuildAll();
	await logger.flush();

	expect((await cards.get(card.id))?.accuracy).toEqual({ n: 1, correct: 1 });
	expect(logged[0]).toMatchObject({
		area: 'replay',
		message: 'rebuilt caches',
		data: { cards: 1, events: 1 }
	});
});
