import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
	CardRepo,
	ChunkRepo,
	CourseRepo,
	MediaRepo,
	NoteRepo,
	TopicRepo
} from '#lib/db/repos/content-repos.ts';
import type { RepoContext } from '#lib/db/repos/content-repo.ts';
import { DeviceRepo } from '#lib/db/repos/device-repo.ts';
import { EventRepo } from '#lib/db/repos/event-repo.ts';
import { KvRepo } from '#lib/db/repos/kv-repo.ts';
import { SessionRepo } from '#lib/db/repos/session-repo.ts';
import { createDb, type SnowpackDb } from '#lib/db/schema.ts';
import { EMPTY_CARD_CACHES, type CardCaches } from '#lib/db/schemas/card.ts';
import type { CardId, CourseId, SessionId, TopicId } from '#lib/db/schemas/common.ts';
import type { Course } from '#lib/db/schemas/course.ts';
import { DEFAULT_SETTINGS } from '#lib/db/schemas/kv.ts';

const START = 1_000;
const courseFields = {
	name: 'Networks',
	status: 'active',
	examFormat: 'mixed',
	color: 'sky'
} as const;

describe('repositories', () => {
	let db: SnowpackDb;
	let device: DeviceRepo;
	let context: RepoContext;
	let now: number;
	let dbCount = 0;

	beforeEach(() => {
		dbCount += 1;
		db = createDb(`repos-test-${dbCount}`);
		now = START;
		device = new DeviceRepo(db, randomUUID);
		context = { clock: () => now, newId: randomUUID, getDeviceId: () => device.getDeviceId() };
	});

	afterEach(async () => {
		await db.delete();
	});

	async function createCourse(): Promise<Course> {
		return new CourseRepo(db, context).create(courseFields);
	}

	describe('device identity and seq', () => {
		it('creates the device ID once and keeps it across restarts', async () => {
			const first = await device.getDeviceId();
			expect(await device.getDeviceId()).toBe(first);
			expect(await new DeviceRepo(db, randomUUID).getDeviceId()).toBe(first);
		});

		it('hands out strictly increasing seq numbers that survive a restart', async () => {
			const seen = [await device.nextSeq(), await device.nextSeq()];
			seen.push(await new DeviceRepo(db, randomUUID).nextSeq());
			expect(seen).toEqual([1, 2, 3]);
		});
	});

	describe('content writes', () => {
		it('sets the ID, timestamps and device on create', async () => {
			const course = await createCourse();
			expect(course).toMatchObject({
				...courseFields,
				createdAt: START,
				updatedAt: START,
				deviceId: await device.getDeviceId()
			});
			expect(course.id).toMatch(/^[0-9a-f-]{36}$/);
			expect(course.deleted).toBeUndefined();
		});

		it('bumps updatedAt on update and keeps createdAt', async () => {
			const repo = new CourseRepo(db, context);
			const course = await repo.create(courseFields);
			now = START + 5;
			const updated = await repo.update(course.id, { name: 'Databases' });
			expect(updated).toMatchObject({ name: 'Databases', createdAt: START, updatedAt: START + 5 });
			expect((await repo.get(course.id))?.name).toBe('Databases');
		});

		it('rejects a record that breaks its schema', async () => {
			const repo = new CourseRepo(db, context);
			await expect(repo.create({ ...courseFields, name: '' })).rejects.toThrow();
			const course = await repo.create(courseFields);
			await expect(repo.update(course.id, { name: '' })).rejects.toThrow();
		});

		it('refuses to update a missing or deleted record', async () => {
			const repo = new CourseRepo(db, context);
			await expect(repo.update(randomUUID(), { name: 'x' })).rejects.toThrow(/No live record/);
			const course = await repo.create(courseFields);
			await repo.softDelete(course.id);
			await expect(repo.update(course.id, { name: 'x' })).rejects.toThrow(/No live record/);
		});

		it('deletes by tombstone: hidden from reads, kept in the table', async () => {
			const repo = new CourseRepo(db, context);
			const course = await repo.create(courseFields);
			now = START + 9;
			await repo.softDelete(course.id);

			expect(await repo.get(course.id)).toBeUndefined();
			expect(await repo.list()).toEqual([]);
			expect(await db.courses.get(course.id)).toMatchObject({
				deleted: true,
				updatedAt: START + 9
			});
		});

		it('ignores deleting a record that does not exist', async () => {
			await expect(new CourseRepo(db, context).softDelete(randomUUID())).resolves.toBeUndefined();
		});
	});

	describe('queries', () => {
		const topicFields = (courseId: CourseId, order: number) =>
			({ courseId, name: `t${order}`, order, placement: 'unread', priority: 'normal' }) as const;

		it('lists topics by course in order, without tombstones', async () => {
			const course = await createCourse();
			const repo = new TopicRepo(db, context);
			await repo.create(topicFields(course.id, 2));
			await repo.create(topicFields(course.id, 0));
			const gone = await repo.create(topicFields(course.id, 1));
			await repo.create(topicFields(randomUUID() as CourseId, 0));
			await repo.softDelete(gone.id);

			expect((await repo.listByCourse(course.id)).map((t) => t.order)).toEqual([0, 2]);
		});

		it('lists chunks by topic in reading order', async () => {
			const topicId = randomUUID() as TopicId;
			const repo = new ChunkRepo(db, context);
			for (const order of [1, 0]) {
				await repo.create({ topicId, order, text: 'x', words: 1, source: 'notes' });
			}
			expect((await repo.listByTopic(topicId)).map((c) => c.order)).toEqual([0, 1]);
		});

		it('finds a live image by hash', async () => {
			const repo = new MediaRepo(db, context);
			const hash = 'a'.repeat(64);
			const media = await repo.create({
				hash,
				mime: 'image/webp',
				width: 1,
				height: 1,
				bytes: 1,
				blob: new Blob(['x'])
			});
			expect((await repo.findByHash(hash))?.id).toBe(media.id);
			await repo.softDelete(media.id);
			expect(await repo.findByHash(hash)).toBeUndefined();
		});
	});

	describe('notes', () => {
		const base = () => ({
			courseId: randomUUID() as CourseId,
			topicId: randomUUID() as TopicId,
			order: 0,
			priority: 'normal' as const,
			tags: [],
			generated: false,
			check: false,
			accept: {}
		});

		it('stores a note and lists it by topic', async () => {
			const repo = new NoteRepo(db, context);
			const fields = base();
			const note = await repo.create({
				...fields,
				type: 'fact',
				payload: { term: 'TCP', definition: 'reliable' }
			});
			expect((await repo.listByTopic(fields.topicId)).map((n) => n.id)).toEqual([note.id]);
		});

		it('rejects a payload that does not match its type', async () => {
			const repo = new NoteRepo(db, context);
			await expect(
				repo.create({
					...base(),
					type: 'fact',
					payload: { term: 'TCP' }
				} as never)
			).rejects.toThrow();
		});

		it('rejects a comparison row of the wrong width, and a stack with edges', async () => {
			const repo = new NoteRepo(db, context);
			await expect(
				repo.create({
					...base(),
					type: 'compare',
					payload: { items: ['A', 'B'], rows: [{ attribute: 'x', values: ['1'] }] }
				})
			).rejects.toThrow(/one value per item/);

			const node = randomUUID();
			await expect(
				repo.create({
					...base(),
					type: 'diagram',
					payload: {
						kind: 'stack',
						name: 'OSI',
						nodes: [{ id: node, label: 'Network' }],
						edges: [{ id: randomUUID(), from: node, to: node }]
					}
				})
			).rejects.toThrow(/no edges/);
		});

		it('rejects a flow edge whose endpoint does not exist', async () => {
			await expect(
				new NoteRepo(db, context).create({
					...base(),
					type: 'diagram',
					payload: {
						kind: 'flow',
						name: 'Query',
						nodes: [],
						edges: [{ id: randomUUID(), from: randomUUID(), to: randomUUID() }]
					}
				})
			).rejects.toThrow(/endpoints/);
		});
	});

	describe('cards', () => {
		const content = (noteId = randomUUID()) => ({
			noteId: noteId as never,
			courseId: randomUUID() as CourseId,
			variant: 'fwd',
			path: ['mc', 'cloze'] as ('mc' | 'cloze')[],
			suspended: false
		});

		it('creates a card with empty caches', async () => {
			const card = await new CardRepo(db, context).create(content());
			expect(card).toMatchObject(EMPTY_CARD_CACHES);
		});

		it('writes caches from replay without touching updatedAt, and clears a stale due', async () => {
			const repo = new CardRepo(db, context);
			const card = await repo.create(content());
			now = START + 100;
			const caches: CardCaches = { ...EMPTY_CARD_CACHES, due: 5, status: 'provisional' };
			await repo.applyReplay({ [card.id]: caches } as Record<CardId, CardCaches>);

			expect(await repo.get(card.id)).toMatchObject({
				status: 'provisional',
				due: 5,
				updatedAt: START
			});

			await repo.applyReplay({ [card.id]: EMPTY_CARD_CACHES } as Record<CardId, CardCaches>);
			expect((await repo.get(card.id))?.due).toBeUndefined();
		});

		it('lists cards by note and course', async () => {
			const repo = new CardRepo(db, context);
			const fields = content();
			const card = await repo.create(fields);
			await repo.create(content());
			expect((await repo.listByNote(fields.noteId)).map((c) => c.id)).toEqual([card.id]);
			expect((await repo.listByCourse(fields.courseId)).map((c) => c.id)).toEqual([card.id]);
		});
	});

	describe('event log', () => {
		const review = (cardId: CardId, sessionId: SessionId) =>
			({
				type: 'review',
				cardId,
				sessionId,
				mode: 'cram',
				kind: 'cloze',
				weight: 'full',
				firstAttempt: true,
				correct: true,
				responseMs: 10,
				credited: true
			}) as const;

		function repo(): EventRepo {
			return new EventRepo(db, { clock: () => now, newId: randomUUID, device });
		}

		it('assigns id, time, device and increasing seq', async () => {
			const cardId = randomUUID() as CardId;
			const sessionId = randomUUID() as SessionId;
			const first = await repo().append(review(cardId, sessionId));
			const second = await repo().append(review(cardId, sessionId));

			expect(first).toMatchObject({ ts: START, deviceId: await device.getDeviceId() });
			expect(second.seq).toBeGreaterThan(first.seq);
			expect(second.id).not.toBe(first.id);
			expect(await repo().list()).toHaveLength(2);
		});

		it('offers no way to change or remove history', () => {
			const methods = Object.getOwnPropertyNames(EventRepo.prototype);
			expect(methods.filter((name) => /update|delete|put|remove|clear/i.test(name))).toEqual([]);
		});

		it('lists by card oldest first, and by session', async () => {
			const cardId = randomUUID() as CardId;
			const sessionId = randomUUID() as SessionId;
			now = START + 2;
			const later = await repo().append(review(cardId, sessionId));
			now = START + 1;
			const earlier = await repo().append(review(cardId, randomUUID() as SessionId));
			await repo().append(review(randomUUID() as CardId, sessionId));

			expect((await repo().listByCard(cardId)).map((e) => e.id)).toEqual([earlier.id, later.id]);
			expect(await repo().listBySession(sessionId)).toHaveLength(2);
		});

		it('rejects a malformed event', async () => {
			const bad = { ...review(randomUUID() as CardId, randomUUID() as SessionId), responseMs: -1 };
			await expect(repo().append(bad)).rejects.toThrow();
			expect(await repo().list()).toEqual([]);
		});
	});

	describe('kv', () => {
		it('returns undefined for a key never set, and round-trips a value', async () => {
			const kv = new KvRepo(db);
			expect(await kv.get('settings')).toBeUndefined();
			await kv.set('settings', DEFAULT_SETTINGS);
			expect(await kv.get('settings')).toEqual(DEFAULT_SETTINGS);
		});

		it('validates reads and writes', async () => {
			const kv = new KvRepo(db);
			await expect(kv.set('lastExportAt', 'soon' as never)).rejects.toThrow();
			await db.kv.put({ key: 'lastExportAt', value: 'damaged' });
			await expect(kv.get('lastExportAt')).rejects.toThrow();
		});
	});

	describe('sessions', () => {
		it('saves over the same session, so a closed tab can resume', async () => {
			const repo = new SessionRepo(db);
			const cardId = randomUUID() as CardId;
			const session = {
				id: randomUUID() as SessionId,
				mode: 'cram' as const,
				courseIds: [],
				startedAt: START,
				plannedMinutes: 20,
				phase: 'recall' as const,
				snapshot: { queue: [cardId], cards: {}, clearing: null, cleanup: false }
			};
			await repo.save(session);
			await repo.save({ ...session, snapshot: { ...session.snapshot, queue: [] } });

			expect((await repo.get(session.id))?.snapshot.queue).toEqual([]);
		});
	});
});
