import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { CRITERION_FIRST, CRITERION_LATER, RETENTION_MAX } from '#lib/config/defaults.ts';
import { CardRepo } from '#lib/db/repos/content-repos.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { EventRepo } from '#lib/db/repos/event-repo.ts';
import { KvRepo } from '#lib/db/repos/kv-repo.ts';
import { SessionRepo } from '#lib/db/repos/session-repo.ts';
import { createDb } from '#lib/db/schema.ts';
import type { Card } from '#lib/db/schemas/card.ts';
import type { CourseId, NoteId } from '#lib/db/schemas/common.ts';
import type { ReviewEvent } from '#lib/db/schemas/event.ts';
import { DEFAULT_SETTINGS } from '#lib/db/schemas/kv.ts';
import { toPlanCard } from '#lib/engine/session.ts';
import { Logger } from '#lib/log/logger.ts';
import { kvReplayConfig, ReplayService } from '#lib/services/replay-service.ts';
import { SessionService, type AnswerInput } from '#lib/services/session-service.ts';

let db = createDb(`session-service-${randomUUID()}`);
const DAY = 86_400_000;
let now = Date.UTC(2026, 2, 10, 12);

afterEach(async () => {
	await db.delete();
});

function setup() {
	db = createDb(`session-service-${randomUUID()}`);
	const clock = () => now;
	const device = new DeviceRepo(db, randomUUID);
	const cards = new CardRepo(db, {
		clock,
		newId: randomUUID,
		getDeviceId: () => device.getDeviceId()
	});
	const events = new EventRepo(db, { clock, newId: randomUUID, device });
	const kv = new KvRepo(db);
	const logger = new Logger({ sink: { append: async () => {} }, clock });
	const replayConfig = kvReplayConfig(kv, () => 0);
	const replay = new ReplayService(events, cards, logger, replayConfig);
	const sessions = new SessionRepo(db);
	const service = new SessionService({
		sessions,
		events,
		cards,
		replay,
		replayConfig,
		clock,
		newId: randomUUID,
		logger
	});
	return { service, cards, events, kv, replay };
}

async function makeCards(repo: CardRepo, n: number): Promise<Card[]> {
	const courseId = randomUUID() as CourseId;
	const made: Card[] = [];
	for (let i = 0; i < n; i += 1) {
		made.push(
			await repo.create({
				noteId: randomUUID() as NoteId,
				courseId,
				variant: 'c0',
				path: ['cloze'],
				suspended: false
			})
		);
	}
	return made;
}

const right: AnswerInput = { kind: 'cloze', correct: true, responseMs: 5, credited: true };
const wrong: AnswerInput = { ...right, correct: false };

describe('SessionService', () => {
	it('drills a card to the criterion, logging events and replaying caches', async () => {
		const { service, cards, events } = setup();
		const [card] = await makeCards(cards, 1);
		if (!card) throw new Error('no card');
		const plan = [toPlanCard(card, 'cloze', [])];
		let view = await service.start({
			mode: 'longterm',
			courseIds: [],
			plannedMinutes: 10,
			cards: plan,
			confusionEvents: []
		});
		expect(view.item).toMatchObject({ cardId: card.id, firstAttempt: true, attempt: 0 });

		for (let i = 0; i < CRITERION_FIRST; i += 1)
			view = await service.answer(view.session.id, right);

		expect(view.item).toBeNull();
		expect(view.session.endedAt).toBe(now);
		const logged = (await events.listByCard(card.id)) as ReviewEvent[];
		expect(logged).toHaveLength(CRITERION_FIRST);
		expect(logged.every((event) => event.weight === 'full' && event.firstAttempt)).toBe(true);
		const stored = await cards.get(card.id);
		expect(stored?.accuracy).toEqual({ n: CRITERION_FIRST, correct: CRITERION_FIRST });
		expect(stored?.status).toBe('provisional');
		expect(stored?.fsrs).not.toBeNull();
	});

	it('logs redo attempts as not first, then cleans up the failed card', async () => {
		const { service, cards, events } = setup();
		const made = await makeCards(cards, 2);
		const plan = made.map((card) => ({
			...toPlanCard(card, 'cloze', []),
			required: CRITERION_LATER
		}));
		let view = await service.start({
			mode: 'cram',
			courseIds: [],
			plannedMinutes: 5,
			cards: plan,
			confusionEvents: []
		});
		const failedId = view.item?.cardId;

		view = await service.answer(view.session.id, wrong);
		expect(view.item).toMatchObject({ cardId: failedId, firstAttempt: false, attempt: 1 });
		view = await service.answer(view.session.id, right);
		while (view.item && view.session.phase !== 'cleanup')
			view = await service.answer(view.session.id, right);

		expect(view.session.phase).toBe('cleanup');
		expect(view.item?.cardId).toBe(failedId);
		view = await service.answer(view.session.id, right);
		expect(view.item).toBeNull();
		expect(view.session.endedAt).toBeDefined();
		// Every event shares the fixed clock, so order by the per-device seq.
		const logged = (await events.listByCard(failedId!)) as ReviewEvent[];
		const firstAttempts = logged.sort((a, b) => a.seq - b.seq).map((e) => e.firstAttempt);
		expect(firstAttempts.slice(0, 2)).toEqual([true, false]);
	});

	it('resumes a closed session exactly where it stopped', async () => {
		const { service, cards } = setup();
		const made = await makeCards(cards, 3);
		const plan = made.map((card) => toPlanCard(card, 'cloze', []));
		const started = await service.start({
			mode: 'longterm',
			courseIds: [],
			plannedMinutes: 10,
			cards: plan,
			confusionEvents: []
		});
		const after = await service.answer(started.session.id, wrong);

		const resumed = await service.resume(started.session.id);
		expect(resumed).toStrictEqual(after);
		expect(await service.resume(randomUUID() as never)).toBeUndefined();
	});

	it('refuses an answer when the session has nothing left', async () => {
		const { service } = setup();
		const view = await service.start({
			mode: 'longterm',
			courseIds: [],
			plannedMinutes: 1,
			cards: [],
			confusionEvents: []
		});
		await expect(service.answer(view.session.id, right)).rejects.toThrow('no current card');
	});
});

describe('kvReplayConfig and rebuildCards', () => {
	it('reads retention from settings, weights from fsrsParams, and the given offset', async () => {
		const { kv } = setup();
		expect((await kvReplayConfig(kv, () => 60)()).tzOffsetMin).toBe(60);
		await kv.set('settings', { ...DEFAULT_SETTINGS, retention: RETENTION_MAX });
		await kv.set('fsrsParams', { version: 6, params: [1, 2, 3], optimisedAt: 0 });
		const config = await kvReplayConfig(kv, () => 0)();
		expect(config.fsrs.retention).toBe(RETENTION_MAX);
		expect(config.fsrs.weights).toEqual([1, 2, 3]);
	});

	it('replays only the named cards, skipping unknown ids', async () => {
		const { cards, events, replay } = setup();
		const [a, b] = await makeCards(cards, 2);
		if (!a || !b) throw new Error('no cards');
		for (const card of [a, b]) {
			await events.append({
				type: 'review',
				cardId: card.id,
				sessionId: randomUUID() as never,
				mode: 'longterm',
				kind: 'cloze',
				weight: 'full',
				firstAttempt: true,
				correct: true,
				responseMs: 1,
				credited: true
			});
		}
		now += DAY;
		await replay.rebuildCards([a.id, a.id, randomUUID() as never]);
		expect((await cards.get(a.id))?.accuracy.n).toBe(1);
		expect((await cards.get(b.id))?.accuracy.n).toBe(0);
	});
});
