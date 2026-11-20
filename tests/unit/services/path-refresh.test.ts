import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CARD_PATHS_VERSION } from '#lib/config/defaults.ts';
import type { EventRepo } from '#lib/db/repos/event-repo.ts';
import { KvRepo } from '#lib/db/repos/kv-repo.ts';
import type { Card } from '#lib/db/schemas/card.ts';
import type { SessionId } from '#lib/db/schemas/common.ts';
import { Logger } from '#lib/log/logger.ts';
import { refreshCardPaths } from '#lib/services/path-refresh.ts';
import { ReplayService } from '#lib/services/replay-service.ts';
import { setupCardEnv, type CardEnv } from './card-list-fixtures.ts';

/**
 * The one-time path refresh (Phase 8.6 step 4): stored cards move onto the new list and key-word
 * paths, keeping card IDs, every review event and FSRS state (user requirement, Decisions log
 * "Phase 8.6 Q19").
 */

const REPLY = [
	'@deck Malware',
	'@fact',
	'Malware types :: *virus*, *worm*, *trojan*, *spyware*',
	'Firewall :: a *rule set* that *filters* traffic',
	'TCP :: reliable transport'
].join('\n');

/** The Phase 8.5 paths these cards had before the refresh. */
const OLD_PATH = ['mc', 'cloze'] as const;

describe('refreshCardPaths', () => {
	let env: CardEnv;
	let kv: KvRepo;
	let events: EventRepo;
	let replay: ReplayService;
	let logger: Logger;
	const clock = () => 5_000;

	beforeEach(async () => {
		env = await setupCardEnv();
		kv = new KvRepo(env.db);
		events = env.events;
		logger = new Logger({ sink: { append: async () => {} }, clock });
		replay = new ReplayService(events, env.store.cards, logger);
		await env.importText(REPLY);
		// Simulate data stored before Phase 8.6: every card on the old fixed path.
		for (const card of await env.store.cards.listByCourse(env.courseId)) {
			await env.store.cards.update(card.id, { path: [...OLD_PATH] });
		}
	});

	afterEach(async () => {
		await env.db.delete();
	});

	async function study(card: Card, correct: boolean): Promise<void> {
		await events.append({
			type: 'review',
			cardId: card.id,
			sessionId: randomUUID() as SessionId,
			mode: 'longterm',
			kind: 'mc',
			weight: 'recognition',
			firstAttempt: true,
			correct,
			responseMs: 900,
			credited: true
		});
	}

	const run = () => refreshCardPaths({ kv, store: env.store, replay, logger });
	const byVariantKey = (cards: readonly Card[]) =>
		new Map(cards.map((card) => [`${card.noteId}:${card.variant}`, card]));

	it('keeps card IDs, every review event and FSRS state; only the list and key-word paths change', async () => {
		const before = await env.store.cards.listByCourse(env.courseId);
		for (const [i, card] of before.entries()) await study(card, i % 2 === 0);
		await replay.rebuildAll();
		const studied = byVariantKey(await env.store.cards.listByCourse(env.courseId));
		const eventsBefore = await events.list();

		expect(await run()).toBe(2);

		const after = await env.store.cards.listByCourse(env.courseId);
		expect(after.map((card) => card.id).sort()).toEqual(before.map((card) => card.id).sort());
		expect(await events.list()).toEqual(eventsBefore);
		for (const card of after) {
			const old = studied.get(`${card.noteId}:${card.variant}`);
			expect(old?.id).toBe(card.id);
			expect(card.fsrs).toEqual(old?.fsrs);
			expect(card.due).toEqual(old?.due);
		}
		const list = await env.noteWith('Malware types');
		const idea = await env.noteWith('Firewall');
		const tcp = await env.noteWith('reliable transport');
		const pathOf = (noteId: string, variant: string) =>
			after.find((card) => card.noteId === noteId && card.variant === variant)?.path;
		expect(pathOf(list.id, 'fwd')).toEqual(['listPick', 'listNot', 'listN', 'listAll']);
		expect(pathOf(idea.id, 'fwd')).toEqual(['mc', 'ideaUnit']);
		expect(pathOf(idea.id, 'rev')).toEqual([...OLD_PATH]);
		expect(pathOf(tcp.id, 'fwd')).toEqual([...OLD_PATH]);
		expect(pathOf(tcp.id, 'rev')).toEqual([...OLD_PATH]);
	});

	it('runs once per CARD_PATHS_VERSION', async () => {
		expect(await run()).toBe(2);
		expect(await kv.get('cardPathsVersion')).toBe(CARD_PATHS_VERSION);
		const ids = (await env.store.cards.listByCourse(env.courseId)).map((card) => card.id);
		for (const id of ids) await env.store.cards.update(id, { path: [...OLD_PATH] });
		expect(await run()).toBe(0);
	});

	it('changes nothing for cards already on the current paths', async () => {
		await run();
		await kv.set('cardPathsVersion', 0);
		const before = await env.store.cards.listByCourse(env.courseId);
		expect(await run()).toBe(0);
		expect(await env.store.cards.listByCourse(env.courseId)).toEqual(before);
	});
});
