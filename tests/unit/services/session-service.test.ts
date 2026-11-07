import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import {
	BREAK_MIN,
	BREAK_SUGGEST_AFTER_MIN,
	CRITERION_FIRST_REDUCED,
	CRITERION_LATER,
	RETENTION_MAX,
	ROUND_WORKING_SET
} from '#lib/config/defaults.ts';
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
const MINUTE = 60_000;

type Mode = 'longterm' | 'cram';
type Setup = ReturnType<typeof setup>;

/** Plans the cards as `toPlanCard` would, optionally forcing a criterion count. */
function planFor(made: readonly Card[], mode: Mode, required?: number) {
	return made.map((card) => ({
		...toPlanCard(card, 'cloze', [], { mode, relearningSessionsAhead: 0 }),
		...(required === undefined ? {} : { required })
	}));
}

async function startWith(env: Setup, made: readonly Card[], mode: Mode, required?: number) {
	return env.service.start({
		mode,
		courseIds: [],
		plannedMinutes: 10,
		cards: planFor(made, mode, required),
		confusionEvents: []
	});
}

/** Every event shares the fixed clock, so order a card's events by the per-device seq. */
async function reviewsOf(events: EventRepo, cardId: Card['id']): Promise<ReviewEvent[]> {
	const logged = (await events.listByCard(cardId)) as ReviewEvent[];
	return logged.sort((a, b) => a.seq - b.seq);
}

describe('SessionService', () => {
	it('drills a new long-term card to the reduced criterion, logging required on each event', async () => {
		const env = setup();
		const [card] = await makeCards(env.cards, 1);
		if (!card) throw new Error('no card');
		let view = await startWith(env, [card], 'longterm');
		expect(view.item).toMatchObject({
			cardId: card.id,
			firstAttempt: true,
			attempt: 0,
			count: 0,
			required: CRITERION_FIRST_REDUCED
		});

		for (let i = 0; i < CRITERION_FIRST_REDUCED; i += 1)
			view = await env.service.answer(view.session.id, right);

		expect(view.item).toBeNull();
		expect(view.session.endedAt).toBe(now);
		const logged = await reviewsOf(env.events, card.id);
		expect(logged).toHaveLength(CRITERION_FIRST_REDUCED);
		expect(logged.every((event) => event.required === CRITERION_FIRST_REDUCED)).toBe(true);
		const stored = await env.cards.get(card.id);
		expect(stored?.accuracy).toEqual({
			n: CRITERION_FIRST_REDUCED,
			correct: CRITERION_FIRST_REDUCED
		});
		expect(stored?.status).toBe('provisional');
		expect(stored?.fsrs).not.toBeNull();
	});

	it('logs redo attempts as not first, then cleans up the failed card in its own round', async () => {
		const env = setup();
		const made = await makeCards(env.cards, 2);
		let view = await startWith(env, made, 'cram', CRITERION_LATER);
		const failedId = view.item?.cardId;
		if (!failedId) throw new Error('no current card');

		view = await env.service.answer(view.session.id, wrong);
		expect(view.item).toMatchObject({ cardId: failedId, firstAttempt: false, attempt: 1 });
		while (view.item) view = await env.service.answer(view.session.id, right);

		expect(view.round).toMatchObject({ index: 1, finished: 2, carried: 0, remaining: 1 });
		view = await env.service.continueRound(view.session.id, { afterBreak: false });
		expect(view.session.phase).toBe('cleanup');
		expect(view.item?.cardId).toBe(failedId);
		view = await env.service.answer(view.session.id, right);
		expect(view.item).toBeNull();
		expect(view.session.endedAt).toBeDefined();
		const firstAttempts = (await reviewsOf(env.events, failedId)).map((e) => e.firstAttempt);
		expect(firstAttempts.slice(0, 2)).toEqual([true, false]);
	});

	it('runs at most ROUND_WORKING_SET cards per round and refuses answers between rounds', async () => {
		const env = setup();
		const made = await makeCards(env.cards, ROUND_WORKING_SET + 1);
		let view = await startWith(env, made, 'cram', CRITERION_LATER);
		for (let i = 0; i < ROUND_WORKING_SET; i += 1)
			view = await env.service.answer(view.session.id, right);

		expect(view.item).toBeNull();
		expect(view.round).toMatchObject({ index: 1, finished: ROUND_WORKING_SET, remaining: 1 });
		await expect(env.service.answer(view.session.id, right)).rejects.toThrow('no current card');
		view = await env.service.continueRound(view.session.id, { afterBreak: false });
		expect(view.round).toBeNull();
		expect(view.session.snapshot.round.index).toBe(2);
		expect(view.item?.cardId).toBe(made[ROUND_WORKING_SET]?.id);
	});

	it('suggests a break after BREAK_SUGGEST_AFTER_MIN, and a break restarts the timer', async () => {
		const env = setup();
		const made = await makeCards(env.cards, ROUND_WORKING_SET + 1);
		let view = await startWith(env, made, 'cram', CRITERION_LATER);
		for (let i = 0; i < ROUND_WORKING_SET - 1; i += 1)
			view = await env.service.answer(view.session.id, right);
		// Study time passes inside the round; its last answer ends it.
		now += BREAK_SUGGEST_AFTER_MIN * MINUTE;
		view = await env.service.answer(view.session.id, right);
		expect(view.round).toMatchObject({ suggestBreak: true, breakMinutes: BREAK_MIN });

		now += BREAK_MIN * MINUTE;
		view = await env.service.continueRound(view.session.id, { afterBreak: true });
		expect(view.session.snapshot.studySince).toBe(now);
	});

	it('stops here at any time, keeping every answer', async () => {
		const env = setup();
		const made = await makeCards(env.cards, 3);
		let view = await startWith(env, made, 'cram');
		const cardId = view.item?.cardId;
		if (!cardId) throw new Error('no current card');
		view = await env.service.answer(view.session.id, right);

		view = await env.service.stop(view.session.id);
		expect(view.session.endedAt).toBe(now);
		expect(view.item).toBeNull();
		expect(view.round).toBeNull();
		expect(await reviewsOf(env.events, cardId)).toHaveLength(1);
		await expect(env.service.answer(view.session.id, right)).rejects.toThrow('no current card');
	});

	it('resumes a closed session exactly where it stopped', async () => {
		const env = setup();
		const made = await makeCards(env.cards, 3);
		const started = await startWith(env, made, 'longterm');
		const after = await env.service.answer(started.session.id, wrong);

		const resumed = await env.service.resume(started.session.id);
		expect(resumed).toStrictEqual(after);
		expect(await env.service.resume(randomUUID() as never)).toBeUndefined();
	});

	it('ends an empty session at once and refuses answers', async () => {
		const env = setup();
		const view = await startWith(env, [], 'longterm');
		expect(view.session.endedAt).toBe(now);
		await expect(env.service.answer(view.session.id, right)).rejects.toThrow('no current card');
	});

	it('answers one at a time, so a double tap answers the current card only once', async () => {
		const env = setup();
		const made = await makeCards(env.cards, 2);
		const view = await startWith(env, made, 'longterm', CRITERION_LATER);
		const [first, second] = await Promise.all([
			env.service.answer(view.session.id, right),
			env.service.answer(view.session.id, right)
		]);
		expect(first.item?.cardId).not.toBe(view.item?.cardId);
		expect(second.item).toBeNull();
		const logged = await Promise.all(made.map((card) => env.events.listByCard(card.id)));
		expect(logged.map((list) => list.length)).toEqual([1, 1]);
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

describe('SessionService: self-rated and pretest answers (Decisions log, Phase 5)', () => {
	it('logs a selfRated event with its fields, and the card is done for the session', async () => {
		const env = setup();
		const [card] = await makeCards(env.cards, 1);
		if (!card) throw new Error('fixture');
		const view = await startWith(env, [card], 'longterm');
		const after = await env.service.answer(view.session.id, {
			kind: 'blurt',
			correct: true,
			responseMs: 9,
			credited: true,
			selfRated: { checked: ['TCP'], missedCardIds: [] }
		});
		const logged = await env.events.listByCard(card.id);
		expect(logged).toHaveLength(1);
		expect(logged[0]).toMatchObject({
			type: 'selfRated',
			noteId: card.noteId,
			cardId: card.id,
			kind: 'blurt',
			checked: ['TCP'],
			missedCardIds: []
		});
		expect(after.session.snapshot.cards[card.id]?.done).toBe(true);
	});

	it('logs a flip rating', async () => {
		const env = setup();
		const [card] = await makeCards(env.cards, 1);
		if (!card) throw new Error('fixture');
		const view = await startWith(env, [card], 'longterm');
		await env.service.answer(view.session.id, {
			kind: 'flip',
			correct: true,
			responseMs: 4,
			credited: true,
			selfRated: { rating: 'hard' }
		});
		expect((await env.events.listByCard(card.id))[0]).toMatchObject({
			type: 'selfRated',
			rating: 'hard'
		});
	});

	it('logs a pretest event, not a review', async () => {
		const env = setup();
		const [card] = await makeCards(env.cards, 1);
		if (!card) throw new Error('fixture');
		const view = await startWith(env, [card], 'longterm');
		await env.service.answer(view.session.id, {
			kind: 'pretest',
			correct: false,
			responseMs: 7,
			credited: false
		});
		const logged = await env.events.listByCard(card.id);
		expect(logged).toHaveLength(1);
		expect(logged[0]).toMatchObject({
			type: 'pretest',
			cardId: card.id,
			skipped: false,
			responseMs: 7
		});
	});
});
