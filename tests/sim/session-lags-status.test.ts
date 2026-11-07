import { describe, expect, it } from 'vitest';
import {
	CRITERION_FIRST,
	CRITERION_LATER,
	ERROR_LAG,
	FRAGILE_CAP_DAYS,
	LAGS
} from '#lib/config/defaults.ts';
import type { CardCaches } from '#lib/db/schemas/card.ts';
import type { CardId, CardStatus, Mode, SessionId } from '#lib/db/schemas/common.ts';
import type { StudyEvent } from '#lib/db/schemas/event.ts';
import type { SessionSnapshot } from '#lib/db/schemas/session.ts';
import { DEFAULT_FSRS_CONFIG, retrievabilityAt } from '#lib/engine/fsrs.ts';
import { applyAnswer, currentItem, type CurrentItem } from '#lib/engine/queue.ts';
import { replay, type ReplayConfig } from '#lib/engine/replay.ts';
import { createRng } from '#lib/engine/rng.ts';
import {
	isSessionComplete,
	planSession,
	startCleanup,
	type PlanCard
} from '#lib/engine/session.ts';
import { MS_PER_DAY } from '#lib/engine/time.ts';
import { cardId, compareText, eventId, makeReview, noteId, uuid } from '../unit/engine/fixtures.ts';
import { writeSimReport, type SimDay, type SimReport, type SimRow } from './harness.ts';

/**
 * Scenario "session lags and status": a simulated learner answers four days of real sessions
 * (acquisition → first credited retest → relearn → cram). Every answer is checked against the
 * documented reinsertion lags, every session against the criterion, and every day's replayed
 * caches against the status rules.
 *
 * @see BUILD_PLAN §6.3, §6.4, §6.5, §11.1 and Decisions log (lags, cleanup, status, weak, fragile)
 */

const SCENARIO = 'session-lags-status';
const SEED = 20_260_901;
const TZ_OFFSET_MIN = 0;
const CONFIG: ReplayConfig = { fsrs: DEFAULT_FSRS_CONFIG, tzOffsetMin: TZ_OFFSET_MIN };
/** Tue 1 Sep 2026, 19:00 UTC: each day's session starts at this time of day. */
const FIRST_SESSION = Date.UTC(2026, 8, 1, 19);
const ANSWER_GAP_MS = 20_000;
/** A runaway guard: a session that needs more answers than this is a bug. */
const MAX_STEPS = 500;

/** Learner model: recall halves every `halfLife` days and the half-life grows on each correct. */
const FIRST_SIGHT_P = 0.5;
const INITIAL_HALF_LIFE_DAYS = 0.5;
const HALF_LIFE_GROWTH = 1.5;

const LABELS = ['easy', 'hard', 'r1', 'r2', 'r3', 'r4'] as const;
const CARDS = LABELS.map((label, i) => ({ label, id: cardId(0x101 + i), note: noteId(0x201 + i) }));
const EASY = cardId(0x101);
const HARD = cardId(0x102);
const labelOf = (id: CardId): string => CARDS.find((card) => card.id === id)?.label ?? id;

interface DayPlan {
	mode: Mode;
	required: number;
	isNew: boolean;
}
const DAYS: readonly DayPlan[] = [
	{ mode: 'acquisition', required: CRITERION_FIRST, isNew: true },
	{ mode: 'longterm', required: CRITERION_FIRST, isNew: false },
	{ mode: 'longterm', required: CRITERION_LATER, isNew: false },
	{ mode: 'cram', required: CRITERION_LATER, isNew: false }
];

type Learner = (id: CardId, ts: number, firstOfSession: boolean) => boolean;

/** Pinned cards make both outcomes certain: `easy` is always right; `hard` misses each session's first try. */
function createLearner(seed: number): Learner {
	const rng = createRng(seed);
	const memory = new Map<CardId, { lastTs: number; halfLifeDays: number }>();
	return (id, ts, firstOfSession) => {
		const draw = rng();
		const known = memory.get(id);
		let p: number;
		if (id === EASY) p = 1;
		else if (id === HARD) p = firstOfSession ? 0 : 1;
		else if (!known) p = FIRST_SIGHT_P;
		else p = 2 ** -((ts - known.lastTs) / MS_PER_DAY / known.halfLifeDays);
		const correct = draw < p;
		const halfLifeDays = known?.halfLifeDays ?? INITIAL_HALF_LIFE_DAYS;
		memory.set(id, {
			lastTs: ts,
			halfLifeDays: correct ? halfLifeDays * HALF_LIFE_GROWTH : halfLifeDays
		});
		return correct;
	};
}

const lagFor = (count: number): number => LAGS[Math.min(count, LAGS.length) - 1] ?? Number.NaN;
const insertAt = (rest: readonly CardId[], lag: number, id: CardId): CardId[] => [
	...rest.slice(0, lag),
	id,
	...rest.slice(lag)
];

/** Checks one answer against §6.4 and the lag decisions; returns the lag used, if any. */
function checkTransition(
	before: SessionSnapshot,
	item: CurrentItem,
	correct: boolean,
	after: SessionSnapshot
): string {
	const id = item.cardId;
	const rest = before.queue.slice(1);
	const was = before.cards[id];
	const now = after.cards[id];
	if (!was || !now) throw new Error(`card ${labelOf(id)} missing from the snapshot`);
	expect(now.attempt).toBe(was.attempt + 1);
	if (!item.firstAttempt) {
		if (!correct) {
			expect(after.queue).toStrictEqual(before.queue);
			return 'redo-again';
		}
		expect(after.clearing).toBeNull();
		expect(after.queue).toStrictEqual(insertAt(rest, ERROR_LAG, id));
		return `error-lag-${ERROR_LAG}`;
	}
	if (!correct) {
		expect(now.count).toBe(0);
		expect(now.failed).toBe(true);
		expect(after.clearing).toBe(id);
		expect(after.queue[0]).toBe(id);
		expect(currentItem(after)?.firstAttempt).toBe(false);
		return 'clearing';
	}
	const count = was.count + 1;
	if (count >= was.required || item.phase === 'cleanup') {
		expect(now.done).toBe(true);
		expect(after.queue).toStrictEqual(rest);
		return 'done';
	}
	expect(now.count).toBe(count);
	expect(after.queue).toStrictEqual(insertAt(rest, lagFor(count), id));
	return `lag-${lagFor(count)}`;
}

/** Counting corrects per card in the main phase, reset on a wrong first attempt (§6.3). */
function criterionMet(
	events: readonly StudyEvent[],
	sessionId: SessionId,
	required: number
): Record<string, boolean> {
	const count = new Map<string, number>();
	const met: Record<string, boolean> = {};
	for (const event of events) {
		if (event.type !== 'review' || event.sessionId !== sessionId || !event.firstAttempt) continue;
		const next = event.correct ? (count.get(event.cardId) ?? 0) + 1 : 0;
		count.set(event.cardId, next);
		if (next >= required) met[event.cardId] = true;
	}
	return met;
}

interface SessionResult {
	answers: number;
	firstCorrect: Map<CardId, boolean>;
	cleanupOrder: string[];
	lagsUsed: Record<string, number>;
}

function runSession(
	day: number,
	plan: DayPlan,
	learner: Learner,
	events: StudyEvent[],
	prior: Record<CardId, CardCaches>
): SessionResult {
	const sessionId = uuid(0x5e00 + day) as SessionId;
	const cards: PlanCard[] = CARDS.map(({ id, note }) => ({
		id,
		noteId: note,
		noteType: 'keyterm',
		kind: 'cloze',
		isNew: plan.isNew,
		required: plan.required
	}));
	let state = planSession({ cards, confusionEvents: [] }).result;
	expect([...state.queue].sort(compareText)).toStrictEqual(
		CARDS.map((c) => c.id).sort(compareText)
	);
	let ts = FIRST_SESSION + day * MS_PER_DAY;
	const shown = new Set<CardId>();
	const result: SessionResult = {
		answers: 0,
		firstCorrect: new Map(),
		cleanupOrder: [],
		lagsUsed: {}
	};
	for (let step = 0; step < MAX_STEPS; step += 1) {
		const item = currentItem(state);
		if (!item) {
			if (state.cleanup) break;
			const retrievability: Record<CardId, number> = {};
			for (const { id } of CARDS)
				retrievability[id] = retrievabilityAt(prior[id]?.fsrs ?? null, ts);
			const expected = CARDS.map((c) => c.id)
				.filter((id) => state.cards[id]?.failed)
				.sort((a, b) => (retrievability[a] ?? 0) - (retrievability[b] ?? 0) || compareText(a, b));
			state = startCleanup(state, retrievability).result;
			expect(state.cleanup).toBe(true);
			expect(state.queue).toStrictEqual(expected);
			if (expected.length > 0) expect(currentItem(state)?.phase).toBe('cleanup');
			result.cleanupOrder = expected.map(labelOf);
			continue;
		}
		const correct = learner(item.cardId, ts, !shown.has(item.cardId));
		shown.add(item.cardId);
		result.answers += 1;
		events.push(
			makeReview({
				id: eventId(0x10_000 + events.length),
				seq: events.length + 1,
				ts,
				cardId: item.cardId,
				sessionId,
				mode: plan.mode,
				kind: 'cloze',
				weight: 'full',
				firstAttempt: item.firstAttempt,
				correct,
				credited: plan.mode !== 'acquisition'
			})
		);
		if (item.firstAttempt && !result.firstCorrect.has(item.cardId))
			result.firstCorrect.set(item.cardId, correct);
		const before = state;
		state = applyAnswer(state, { cardId: item.cardId, correct, weight: 'full' }).result;
		const lag = checkTransition(before, item, correct, state);
		result.lagsUsed[lag] = (result.lagsUsed[lag] ?? 0) + 1;
		ts += ANSWER_GAP_MS;
	}
	expect(isSessionComplete(state)).toBe(true);
	for (const { id } of CARDS) expect(state.cards[id]?.done).toBe(true);
	const met = criterionMet(events, sessionId, plan.required);
	for (const { id } of CARDS)
		expect({ card: labelOf(id), met: met[id] ?? false }).toStrictEqual({
			card: labelOf(id),
			met: true
		});
	return result;
}

interface Expected {
	status: CardStatus;
	daysCorrect: number;
	weak: boolean;
}

/** What §6.5 and the Decisions log predict for one card after `day`. */
function expectedFor(day: number, firstCorrect: readonly (boolean | undefined)[]): Expected {
	if (day === 0) return { status: 'learning', daysCorrect: 0, weak: false };
	if (day === 1) return { status: 'provisional', daysCorrect: 1, weak: false };
	if (firstCorrect[day] === false) return { status: 'needs-work', daysCorrect: 0, weak: true };
	if (day === 2) return { status: 'exam-ready', daysCorrect: 2, weak: false };
	// Day 3 is cram: its criterion is met, so a correct start is exam-ready (Decisions log: status).
	return { status: 'exam-ready', daysCorrect: firstCorrect[2] === false ? 1 : 3, weak: false };
}

function checkDay(
	day: number,
	plan: DayPlan,
	caches: Record<CardId, CardCaches>,
	prior: Record<CardId, CardCaches>,
	history: Map<CardId, (boolean | undefined)[]>
): SimRow[] {
	return CARDS.map(({ id, label }) => {
		const card = caches[id];
		if (!card) throw new Error(`no caches for ${label}`);
		const firsts = history.get(id) ?? [];
		const want = expectedFor(day, firsts);
		expect({
			day,
			label,
			status: card.status,
			daysCorrect: card.daysCorrect,
			weak: card.weak
		}).toStrictEqual({ day, label, ...want });
		expect(card.fsrs?.reps ?? 0).toBe(day);
		if (plan.mode !== 'cram') expect(card.fragile).toBe(false);
		else if (firsts[day] === true) {
			const cap = Math.max(prior[id]?.fsrs?.stability ?? 0, FRAGILE_CAP_DAYS);
			expect(card.fsrs?.stability ?? Infinity).toBeLessThanOrEqual(cap);
			expect(card.fragile).toBe((card.fsrs?.stability ?? Infinity) <= FRAGILE_CAP_DAYS);
		}
		return {
			card: label,
			firstTry: firsts[day] === undefined ? '-' : firsts[day] ? 'right' : 'wrong',
			status: card.status,
			daysCorrect: card.daysCorrect,
			weak: card.weak,
			fragile: card.fragile
		};
	});
}

function runScenario(seed: number): SimReport {
	const learner = createLearner(seed);
	const events: StudyEvent[] = [];
	const replayCards = CARDS.map(({ id }) => ({ id, path: ['cloze' as const] }));
	const history = new Map<CardId, (boolean | undefined)[]>(CARDS.map(({ id }) => [id, []]));
	let prior = replay(events, replayCards, CONFIG).result;
	const days: SimDay[] = [];
	DAYS.forEach((plan, day) => {
		const session = runSession(day, plan, learner, events, prior);
		for (const { id } of CARDS) history.get(id)?.push(session.firstCorrect.get(id));
		const caches = replay(events, replayCards, CONFIG).result;
		const rows = checkDay(day, plan, caches, prior, history);
		days.push({
			day,
			summary: `${plan.mode} session, ${plan.required} counting correct(s) required, ${session.answers} answers; cleanup: ${session.cleanupOrder.join(', ') || 'none'}`,
			rows,
			details: { mode: plan.mode, lagsUsed: session.lagsUsed, cleanupOrder: session.cleanupOrder }
		});
		prior = caches;
	});
	return { scenario: SCENARIO, passed: true, seed, days, metrics: { answers: events.length } };
}

describe(`sim: ${SCENARIO}`, () => {
	it('follows the lags, meets the criterion and gives the documented statuses day by day', () => {
		let report: SimReport;
		try {
			report = runScenario(SEED);
		} catch (error) {
			writeSimReport({
				scenario: SCENARIO,
				passed: false,
				seed: SEED,
				days: [],
				error: String(error)
			});
			throw error;
		}
		writeSimReport(report);
		const statusesOn = (day: number) => new Set(report.days[day]?.rows.map((row) => row.status));
		expect(statusesOn(0)).toStrictEqual(new Set(['learning']));
		expect(statusesOn(1)).toStrictEqual(new Set(['provisional']));
		expect(statusesOn(2)).toStrictEqual(new Set(['needs-work', 'exam-ready']));
		expect(statusesOn(3).has('needs-work') && statusesOn(3).has('exam-ready')).toBe(true);
		expect(
			report.days.some((day) => (day.details?.cleanupOrder as string[]).includes('hard'))
		).toBe(true);
	});

	it('gives the same report for the same seed', () => {
		expect(runScenario(SEED)).toStrictEqual(runScenario(SEED));
	});
});
