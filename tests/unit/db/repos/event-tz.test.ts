import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { EventRepo, type EventRepoDeps } from '#lib/db/repos/event-repo.ts';
import { createDb, type SnowpackDb } from '#lib/db/schema.ts';
import type { CardId, SessionId } from '#lib/db/schemas/common.ts';
import { StudyEventSchema } from '#lib/db/schemas/event.ts';

/**
 * `tzOffsetMin` on events (DATA_MODEL §3.6, BUILD_PLAN §6.12 "Event time zone", Decisions log
 * "Fix pass (A10)"): optional integer −840…840, stored by EventRepo from its `tzOffsetMin` dep.
 */

const START = 1_000;
const TZ_EAST = 120;
const TZ_WEST = -300;
/** The widest offsets DATA_MODEL §3.6 allows (UTC+14 and UTC−14). */
const TZ_MAX = 840;
const TZ_MIN = -840;

const review = () =>
	({
		type: 'review',
		cardId: randomUUID() as CardId,
		sessionId: randomUUID() as SessionId,
		mode: 'longterm',
		kind: 'cloze',
		weight: 'full',
		firstAttempt: true,
		correct: true,
		responseMs: 10,
		credited: true
	}) as const;

describe('EventRepo: tzOffsetMin', () => {
	let db: SnowpackDb;
	let device: DeviceRepo;
	let dbCount = 0;

	beforeEach(() => {
		dbCount += 1;
		db = createDb(`event-tz-test-${dbCount}`);
		device = new DeviceRepo(db, randomUUID);
	});

	afterEach(async () => {
		await db.delete();
	});

	function repo(tz?: () => number): EventRepo {
		const deps: EventRepoDeps = { clock: () => START, newId: randomUUID, device };
		return new EventRepo(db, tz ? { ...deps, tzOffsetMin: tz } : deps);
	}

	it('stores the device offset on each event when the dep is given', async () => {
		const event = await repo(() => TZ_EAST).append(review());
		expect(event.tzOffsetMin).toBe(TZ_EAST);
		expect((await repo().list())[0]?.tzOffsetMin).toBe(TZ_EAST);
	});

	it('reads the offset at each append, so travel changes only later events', async () => {
		let tz = TZ_EAST;
		const events = repo(() => tz);
		const before = await events.append(review());
		tz = TZ_WEST;
		const after = await events.append(review());
		expect([before.tzOffsetMin, after.tzOffsetMin]).toStrictEqual([TZ_EAST, TZ_WEST]);
		const stored = await repo().list();
		expect(stored.find((e) => e.id === before.id)?.tzOffsetMin).toBe(TZ_EAST);
	});

	it('stores an offset of 0', async () => {
		expect((await repo(() => 0).append(review())).tzOffsetMin).toBe(0);
	});

	it('omits tzOffsetMin when the dep is absent', async () => {
		const event = await repo().append(review());
		expect('tzOffsetMin' in event).toBe(false);
		const [stored] = await repo().list();
		expect(stored && 'tzOffsetMin' in stored).toBe(false);
	});
});

describe('StudyEventSchema: tzOffsetMin', () => {
	const base = {
		...review(),
		id: randomUUID(),
		ts: START,
		deviceId: randomUUID(),
		seq: 1
	};

	it('accepts an event without tzOffsetMin (logged before the field existed)', () => {
		expect(StudyEventSchema.safeParse(base).success).toBe(true);
	});

	it.each([TZ_MIN, TZ_WEST, 0, TZ_EAST, TZ_MAX])('accepts the integer offset %d', (tz) => {
		expect(StudyEventSchema.safeParse({ ...base, tzOffsetMin: tz }).success).toBe(true);
	});

	it.each([TZ_MIN - 1, TZ_MAX + 1])('rejects %d, outside −840…840', (tz) => {
		expect(StudyEventSchema.safeParse({ ...base, tzOffsetMin: tz }).success).toBe(false);
	});

	it.each([TZ_EAST + 0.5, Number.NaN])('rejects the non-integer offset %d', (tz) => {
		expect(StudyEventSchema.safeParse({ ...base, tzOffsetMin: tz }).success).toBe(false);
	});
});
