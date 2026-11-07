import { describe, expect, it } from 'vitest';
import {
	BREAK_MIN,
	BREAK_SUGGEST_AFTER_MIN,
	CRITERION_FIRST,
	CRITERION_FIRST_REDUCED,
	CRITERION_LATER,
	ERROR_LAG,
	FRAGILE_CAP_DAYS,
	LAGS,
	ROUND_MAX_ANSWERS,
	ROUND_MAX_MINUTES,
	ROUND_WORKING_SET
} from '#lib/config/defaults.ts';
import type { CardCaches } from '#lib/db/schemas/card.ts';
import type { CardId, CardStatus, Mode, SessionId } from '#lib/db/schemas/common.ts';
import type { ReviewEvent, StudyEvent } from '#lib/db/schemas/event.ts';
import type { SessionSnapshot } from '#lib/db/schemas/session.ts';
import { DEFAULT_FSRS_CONFIG, retrievabilityAt } from '#lib/engine/fsrs.ts';
import { applyAnswer, currentItem, type CurrentItem } from '#lib/engine/queue.ts';
import { replay, type ReplayConfig } from '#lib/engine/replay.ts';
import { createRng } from '#lib/engine/rng.ts';
import { checkRoundEnd, roundSummary, startRound } from '#lib/engine/round.ts';
import {
	isSessionComplete,
	planSession,
	startCleanup,
	toPlanCard,
	type PlanCard
} from '#lib/engine/session.ts';
import { MS_PER_DAY } from '#lib/engine/time.ts';
import { cardId, compareText, eventId, makeReview, noteId, uuid } from '../unit/engine/fixtures.ts';
import { writeSimReport, type SimDay, type SimReport, type SimRow } from './harness.ts';

/**
 * Scenario "session lags and status": a simulated learner answers four days of real sessions
 * (acquisition → first credited retest → relearn → cram) with more cards than one round holds, so
 * every session runs in rounds. Every answer is checked against the documented reinsertion lags
 * and the criterion count (progress dots and each event's `required`), every round end against
 * the round rules, every session against the criterion, and every day's replayed caches against
 * the status rules.
 *
 * @see BUILD_PLAN §6.3, §6.4, §6.5, §11.1 and Decisions log (lags, cleanup, status, weak, fragile,
 *   adaptive criterion, known on first try, review `required`, rounds)
 */

const SCENARIO = 'session-lags-status';
const SEED = 20_260_901;
const TZ_OFFSET_MIN = 0;
const CONFIG: ReplayConfig = { fsrs: DEFAULT_FSRS_CONFIG, tzOffsetMin: TZ_OFFSET_MIN };
/** Tue 1 Sep 2026, 19:00 UTC: each day's session starts at this time of day. */
const FIRST_SESSION = Date.UTC(2026, 8, 1, 19);
const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
/** A runaway guard: a session that needs more steps than this is a bug. */
const MAX_STEPS = 2_000;

/** Learner model: recall halves every `halfLife` days and the half-life grows on each correct. */
const FIRST_SIGHT_P = 0.5;
const INITIAL_HALF_LIFE_DAYS = 0.5;
const HALF_LIFE_GROWTH = 1.5;

/** More cards than `ROUND_WORKING_SET`, so every session has a backlog and several rounds. */
const LABELS = [
	'easy',
	'hard',
	'r1',
	'r2',
	'r3',
	'r4',
	'r5',
	'r6',
	'r7',
	'r8',
	'r9',
	'r10'
] as const;
const CARDS = LABELS.map((label, i) => ({ label, id: cardId(0x101 + i), note: noteId(0x201 + i) }));
const IDS = CARDS.map((card) => card.id);
const EASY = cardId(0x101);
const HARD = cardId(0x102);
const labelOf = (id: CardId): string => CARDS.find((card) => card.id === id)?.label ?? id;

/**
 * One day's session. Seconds between answers are prime and divide neither `ROUND_MAX_MINUTES`,
 * `BREAK_SUGGEST_AFTER_MIN` nor those minus whole breaks, so no answer lands exactly on a time
 * limit (the ≥/> boundary stays out of this scenario). A 47 s gap makes day 0's first round run
 * out of time before its 8 cards can finish (each needs at least CRITERION_FIRST_REDUCED corrects).
 */
interface DayPlan {
	mode: Mode;
	gapSeconds: number;
}
const DAYS: readonly DayPlan[] = [
	{ mode: 'acquisition', gapSeconds: 47 },
	{ mode: 'longterm', gapSeconds: 7 },
	{ mode: 'longterm', gapSeconds: 23 },
	{ mode: 'cram', gapSeconds: 47 }
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

// ---------------------------------------------------------------------------------------------
// The criterion, worked out from the spec independently of the engine.
// ---------------------------------------------------------------------------------------------

const reviewsOf = (events: readonly StudyEvent[], id: CardId): ReviewEvent[] =>
	events.filter((e): e is ReviewEvent => e.type === 'review' && e.cardId === id);

/** First review ever is a correct full/recognition answer (no pretests in this scenario). */
function knownOnFirstTry(events: readonly StudyEvent[], id: CardId): boolean {
	const first = reviewsOf(events, id)[0];
	return first !== undefined && first.correct && first.weight !== 'none';
}

/** Met in some credited session: counting corrects reached the event's `required`, last one full. */
function metEver(events: readonly StudyEvent[], id: CardId): boolean {
	const count = new Map<string, number>();
	for (const e of reviewsOf(events, id)) {
		if (!e.credited || !e.firstAttempt || e.weight === 'none') continue;
		const next = e.correct ? (count.get(e.sessionId) ?? 0) + 1 : 0;
		count.set(e.sessionId, next);
		if (e.correct && e.weight === 'full' && next >= (e.required ?? Infinity)) return true;
	}
	return false;
}

/** §6.3: the count a card needs at the start of a session (no planned relearning count here). */
function expectedRequired(events: readonly StudyEvent[], id: CardId, mode: Mode): number {
	if (metEver(events, id)) return CRITERION_LATER;
	if (mode === 'longterm' || knownOnFirstTry(events, id)) return CRITERION_FIRST_REDUCED;
	return CRITERION_FIRST;
}

/** The progress the current item should show, tracked answer by answer. */
interface Progress {
	count: number;
	required: number;
	firstEver: boolean;
}

/** Applies one answer to the tracked progress (§6.3, §6.4, Decisions log: known on first try). */
function stepProgress(p: Progress, item: CurrentItem, correct: boolean): Progress {
	if (!item.firstAttempt) return p;
	const required =
		p.firstEver && correct ? Math.min(p.required, CRITERION_FIRST_REDUCED) : p.required;
	return { count: correct ? p.count + 1 : 0, required, firstEver: false };
}

// ---------------------------------------------------------------------------------------------
// Per-answer and per-round checks.
// ---------------------------------------------------------------------------------------------

/** Checks one answer against §6.4 and the lag decisions; returns the lag used. */
function checkTransition(
	before: SessionSnapshot,
	item: CurrentItem,
	correct: boolean,
	after: SessionSnapshot,
	progress: Progress
): string {
	const id = item.cardId;
	const rest = before.queue.slice(1);
	const was = before.cards[id];
	const now = after.cards[id];
	if (!was || !now) throw new Error(`card ${labelOf(id)} missing from the snapshot`);
	expect(now.attempt).toBe(was.attempt + 1);
	expect(after.round.answers).toBe(before.round.answers + 1);
	expect(now.required).toBe(progress.required);
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
	if (progress.count >= progress.required) {
		expect(now.done).toBe(true);
		expect(after.queue).toStrictEqual(rest);
		return 'done';
	}
	expect(now.count).toBe(progress.count);
	expect(after.queue).toStrictEqual(insertAt(rest, lagFor(progress.count), id));
	return `lag-${lagFor(progress.count)}`;
}

type EndReason = 'all-done' | 'answers' | 'minutes';

/** §6.4 rounds: why the round should end after this answer, or null if it must go on. */
function expectedEnd(state: SessionSnapshot, now: number): EndReason | null {
	const elapsed = now - state.round.startedAt;
	// Test-design guard: the gaps are chosen so no answer lands exactly on the time limit.
	expect(elapsed).not.toBe(ROUND_MAX_MINUTES * MS_PER_MINUTE);
	if (state.clearing !== null) return null;
	if (state.round.cards.every((id) => state.cards[id]?.done)) return 'all-done';
	if (state.round.answers >= ROUND_MAX_ANSWERS) return 'answers';
	if (elapsed >= ROUND_MAX_MINUTES * MS_PER_MINUTE) return 'minutes';
	return null;
}

/** Checks `checkRoundEnd` against the round rules; returns the end reason, if the round ended. */
function checkEnd(before: SessionSnapshot, after: SessionSnapshot, now: number): EndReason | null {
	const reason = expectedEnd(before, now);
	if (reason === null) {
		expect(after).toStrictEqual(before);
		return null;
	}
	expect(after).toStrictEqual({ ...before, round: { ...before.round, ended: true } });
	return reason;
}

/** Checks the round summary (§6.4, DESIGN §5 RoundSummary). */
function checkSummary(state: SessionSnapshot, now: number) {
	const summary = roundSummary(state, now);
	const finished = state.round.cards.filter((id) => state.cards[id]?.done).length;
	const carried = state.round.cards.length - finished;
	const sinceStudy = now - state.studySince;
	expect(sinceStudy).not.toBe(BREAK_SUGGEST_AFTER_MIN * MS_PER_MINUTE);
	expect(summary).toStrictEqual({
		index: state.round.index,
		finished,
		carried,
		remaining: carried + state.backlog.length,
		suggestBreak: sinceStudy >= BREAK_SUGGEST_AFTER_MIN * MS_PER_MINUTE,
		breakMinutes: BREAK_MIN
	});
	expect(carried).toBe(state.queue.length);
	return summary;
}

/** Checks `startRound`: carried cards first with their counts, then backlog, up to the working set. */
function checkStart(
	before: SessionSnapshot,
	after: SessionSnapshot,
	now: number,
	afterBreak: boolean
): void {
	const space = ROUND_WORKING_SET - before.queue.length;
	const queue = [...before.queue, ...before.backlog.slice(0, space)];
	expect(after.queue).toStrictEqual(queue);
	expect(after.backlog).toStrictEqual(before.backlog.slice(space));
	expect(after.round).toStrictEqual({
		index: before.round.index + 1,
		startedAt: now,
		answers: 0,
		cards: queue,
		ended: false
	});
	expect(after.studySince).toBe(afterBreak ? now : before.studySince);
	expect(after.clearing).toBeNull();
	for (const id of before.queue) expect(after.cards[id]).toStrictEqual(before.cards[id]);
}

/** Counting corrects per card in one session, reset on a wrong, against each event's `required`. */
function criterionMet(
	events: readonly StudyEvent[],
	sessionId: SessionId
): Record<string, boolean> {
	const count = new Map<string, number>();
	const met: Record<string, boolean> = {};
	for (const event of events) {
		if (event.type !== 'review' || event.sessionId !== sessionId || !event.firstAttempt) continue;
		const next = event.correct ? (count.get(event.cardId) ?? 0) + 1 : 0;
		count.set(event.cardId, next);
		if (event.correct && next >= (event.required ?? Infinity)) met[event.cardId] = true;
	}
	return met;
}

// ---------------------------------------------------------------------------------------------
// The session runner.
// ---------------------------------------------------------------------------------------------

interface RoundLog {
	index: number;
	cards: number;
	answers: number;
	endedBy: EndReason;
	carried: number;
	suggestBreak: boolean;
}

interface SessionResult {
	answers: number;
	firstCorrect: Map<CardId, boolean>;
	startRequired: Record<string, number>;
	cleanupOrder: string[];
	lagsUsed: Record<string, number>;
	rounds: RoundLog[];
	breaks: number;
}

/** Plans the day's cards through `toPlanCard` and checks them against the spec. */
function planCards(
	plan: DayPlan,
	events: readonly StudyEvent[],
	prior: Record<CardId, CardCaches>
) {
	return CARDS.map(({ id, note }): PlanCard => {
		const caches = prior[id];
		if (!caches) throw new Error(`no caches for ${labelOf(id)}`);
		const own = events.filter((e) => 'cardId' in e && e.cardId === id);
		const card = toPlanCard(
			{
				id,
				noteId: note,
				path: ['cloze'],
				pathStep: caches.pathStep,
				accuracy: caches.accuracy,
				status: caches.status
			},
			'keyterm',
			own,
			{ mode: plan.mode, relearningSessionsAhead: 0 }
		);
		expect({ card: labelOf(id), ...card }).toStrictEqual({
			card: labelOf(id),
			id,
			noteId: note,
			noteType: 'keyterm',
			kind: 'cloze',
			isNew: caches.status === 'unseen',
			required: expectedRequired(events, id, plan.mode),
			firstEver: reviewsOf(events, id).length === 0
		});
		return card;
	});
}

function runSession(
	day: number,
	plan: DayPlan,
	learner: Learner,
	events: StudyEvent[],
	prior: Record<CardId, CardCaches>
): SessionResult {
	const sessionId = uuid(0x5e00 + day) as SessionId;
	const gap = plan.gapSeconds * MS_PER_SECOND;
	let ts = FIRST_SESSION + day * MS_PER_DAY;
	const cards = planCards(plan, events, prior);
	let state = planSession({ cards, confusionEvents: [], now: ts }).result;
	expect(state.queue).toStrictEqual(IDS.slice(0, ROUND_WORKING_SET));
	expect(state.backlog).toStrictEqual(IDS.slice(ROUND_WORKING_SET));
	expect(state.round).toStrictEqual({
		index: 1,
		startedAt: ts,
		answers: 0,
		cards: state.queue,
		ended: false
	});
	expect(state.studySince).toBe(ts);
	const progress = new Map<CardId, Progress>(
		cards.map((c) => [c.id, { count: 0, required: c.required, firstEver: c.firstEver }])
	);
	const cleanupSeen = new Set<CardId>();
	const shown = new Set<CardId>();
	const result: SessionResult = {
		answers: 0,
		firstCorrect: new Map(),
		startRequired: Object.fromEntries(cards.map((c) => [labelOf(c.id), c.required])),
		cleanupOrder: [],
		lagsUsed: {},
		rounds: [],
		breaks: 0
	};
	let endedBy: EndReason | null = null;
	for (let step = 0; step < MAX_STEPS; step += 1) {
		expect(state.queue.length).toBeLessThanOrEqual(ROUND_WORKING_SET);
		expect(state.round.cards.length).toBeLessThanOrEqual(ROUND_WORKING_SET);
		const item = currentItem(state);
		if (!item) {
			expect(state.round.ended).toBe(true);
			const summary = checkSummary(state, ts);
			result.rounds.push({
				index: state.round.index,
				cards: state.round.cards.length,
				answers: state.round.answers,
				endedBy: endedBy ?? 'all-done',
				carried: summary.carried,
				suggestBreak: summary.suggestBreak
			});
			if (state.queue.length === 0 && state.backlog.length === 0) {
				if (state.cleanup) break;
				const retrievability: Record<CardId, number> = {};
				for (const id of IDS) retrievability[id] = retrievabilityAt(prior[id]?.fsrs ?? null, ts);
				const expected = IDS.filter((id) => state.cards[id]?.failed).sort(
					(a, b) => (retrievability[a] ?? 0) - (retrievability[b] ?? 0) || compareText(a, b)
				);
				state = startCleanup(state, retrievability).result;
				expect(state.cleanup).toBe(true);
				expect(state.queue).toStrictEqual([]);
				expect(state.backlog).toStrictEqual(expected);
				result.cleanupOrder = expected.map(labelOf);
				if (expected.length === 0) break;
			}
			const afterBreak = summary.suggestBreak;
			if (afterBreak) {
				ts += BREAK_MIN * MS_PER_MINUTE;
				result.breaks += 1;
			}
			const before = state;
			state = startRound(state, ts, { afterBreak }).result;
			checkStart(before, state, ts, afterBreak);
			endedBy = null;
			continue;
		}
		const tracked = progress.get(item.cardId);
		if (!tracked) throw new Error(`untracked card ${labelOf(item.cardId)}`);
		if (item.phase === 'cleanup' && !cleanupSeen.has(item.cardId)) {
			// Cleanup asks for one more counting correct (CONCEPT §6); adopt its numbers from here on.
			// SPEC-GAP: whether cleanup keeps the session count (required = count + 1) or restarts at
			// (0, 1) isn't fixed; only the difference of one is checked.
			cleanupSeen.add(item.cardId);
			expect(item.required - item.count).toBe(1);
			progress.set(item.cardId, { ...tracked, count: item.count, required: item.required });
		}
		const want = progress.get(item.cardId) ?? tracked;
		expect({
			card: labelOf(item.cardId),
			count: item.count,
			required: item.required
		}).toStrictEqual({
			card: labelOf(item.cardId),
			count: want.count,
			required: want.required
		});
		const correct = learner(item.cardId, ts, !shown.has(item.cardId));
		shown.add(item.cardId);
		result.answers += 1;
		const next = stepProgress(want, item, correct);
		const before = state;
		state = applyAnswer(state, { cardId: item.cardId, correct, weight: 'full' }).result;
		const lag = checkTransition(before, item, correct, state, next);
		progress.set(item.cardId, next);
		result.lagsUsed[lag] = (result.lagsUsed[lag] ?? 0) + 1;
		const required = state.cards[item.cardId]?.required;
		expect(required).toBe(next.required);
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
				credited: plan.mode !== 'acquisition',
				...(required === undefined ? {} : { required })
			})
		);
		if (item.firstAttempt && !result.firstCorrect.has(item.cardId))
			result.firstCorrect.set(item.cardId, correct);
		const answered = state;
		state = checkRoundEnd(state, ts).result;
		endedBy = checkEnd(answered, state, ts) ?? endedBy;
		ts += gap;
	}
	expect(isSessionComplete(state)).toBe(true);
	for (const id of IDS) expect(state.cards[id]?.done).toBe(true);
	const sessionEvents = events.filter((e) => e.type === 'review' && e.sessionId === sessionId);
	for (const e of sessionEvents)
		expect(e.type === 'review' && e.required).toBeGreaterThanOrEqual(1);
	const met = criterionMet(events, sessionId);
	for (const id of IDS)
		expect({ card: labelOf(id), met: met[id] ?? false }).toStrictEqual({
			card: labelOf(id),
			met: true
		});
	return result;
}

// ---------------------------------------------------------------------------------------------
// Day-by-day status checks.
// ---------------------------------------------------------------------------------------------

interface Expected {
	status: CardStatus;
	daysCorrect: number;
	weak: boolean;
}

/** What §6.5 and the Decisions log predict for one card after `day`. */
function expectedFor(day: number, firstCorrect: readonly (boolean | undefined)[]): Expected {
	if (day === 0) return { status: 'learning', daysCorrect: 0, weak: false };
	if (day === 1) return { status: 'provisional', daysCorrect: 1, weak: false };
	// Days 2 and 3 are relearning sessions (criterion met on day 1): a wrong first try is weak.
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
	const replayCards = IDS.map((id) => ({ id, path: ['cloze' as const] }));
	const history = new Map<CardId, (boolean | undefined)[]>(IDS.map((id) => [id, []]));
	let prior = replay(events, replayCards, CONFIG).result;
	const days: SimDay[] = [];
	const metrics: Record<string, number> = { rounds: 0, breaks: 0, carriedRounds: 0 };
	DAYS.forEach((plan, day) => {
		const session = runSession(day, plan, learner, events, prior);
		for (const id of IDS) history.get(id)?.push(session.firstCorrect.get(id));
		const caches = replay(events, replayCards, CONFIG).result;
		const rows = checkDay(day, plan, caches, prior, history);
		metrics.rounds = (metrics.rounds ?? 0) + session.rounds.length;
		metrics.breaks = (metrics.breaks ?? 0) + session.breaks;
		for (const round of session.rounds) {
			const key = `roundsEndedBy.${round.endedBy}`;
			metrics[key] = (metrics[key] ?? 0) + 1;
			if (round.carried > 0) metrics.carriedRounds = (metrics.carriedRounds ?? 0) + 1;
		}
		days.push({
			day,
			summary: `${plan.mode} session, ${session.answers} answers in ${session.rounds.length} rounds (${session.breaks} breaks); cleanup: ${session.cleanupOrder.join(', ') || 'none'}`,
			rows,
			details: {
				mode: plan.mode,
				startRequired: session.startRequired,
				lagsUsed: session.lagsUsed,
				cleanupOrder: session.cleanupOrder,
				rounds: session.rounds
			}
		});
		prior = caches;
	});
	metrics.answers = events.length;
	return { scenario: SCENARIO, passed: true, seed, days, metrics };
}

describe(`sim: ${SCENARIO}`, () => {
	it('follows the lags, rounds and criterion and gives the documented statuses day by day', () => {
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
		// Day 0: easy is known on first try (its first answer drops it to the reduced count) and
		// starts at CRITERION_FIRST like every never-seen card; day 1 is a longterm first credited
		// session; days 2 and 3 are relearning sessions.
		const required = (day: number) =>
			report.days[day]?.details?.startRequired as Record<string, number>;
		expect(new Set(Object.values(required(0)))).toStrictEqual(new Set([CRITERION_FIRST]));
		expect(new Set(Object.values(required(1)))).toStrictEqual(new Set([CRITERION_FIRST_REDUCED]));
		expect(new Set(Object.values(required(2)))).toStrictEqual(new Set([CRITERION_LATER]));
		expect(new Set(Object.values(required(3)))).toStrictEqual(new Set([CRITERION_LATER]));
		// Day 0's first round can't finish its cards within ROUND_MAX_MINUTES at a 47 s gap.
		const day0Rounds = report.days[0]?.details?.rounds as RoundLog[];
		expect(day0Rounds[0]?.endedBy).toBe('minutes');
		expect(day0Rounds[0]?.carried).toBeGreaterThan(0);
		expect(report.metrics?.rounds).toBeGreaterThan(DAYS.length);
	});

	it('gives the same report for the same seed', () => {
		expect(runScenario(SEED)).toStrictEqual(runScenario(SEED));
	});
});
