import {
	CRITERION_FIRST,
	CRITERION_FIRST_DEGRADED,
	PRIORITY_WEIGHT,
	RELEARN_SESSIONS_MAX,
	RETENTION
} from '#lib/config/defaults.ts';
import type { CardId } from '#lib/db/schemas/common.ts';
import {
	cramOrder,
	morningTopUp,
	newPerDay,
	nextGap,
	reviewMinutes,
	triage,
	type CramCard,
	type CramPlan,
	type CramPlanInput,
	type CramSession,
	type Degradation
} from './cram-basics.ts';
import { attemptMinutes, p0For, secondsPerAttempt, withMargin, type Standing } from './estimate.ts';
import { compareText } from './replay.ts';
import type { Traced, TraceEntry } from './trace.ts';

export * from './cram-basics.ts';

/**
 * Cram mode's day-by-day plan up to the exam, with the feasibility check and the fixed degrade
 * order. Re-derived from the cards' state every time it is needed.
 *
 * @see BUILD_PLAN §6.6 ("The plan, concretely"), CONCEPT §7 and Decisions log (Phase 7: cram plan)
 */

const MINUTES_PER_DAY = 1440;
const SECONDS_PER_MINUTE = 60;

/** The knobs the degrade steps turn. */
interface Knobs {
	criterion: number;
	relearn: number;
	deferred: ReadonlySet<CardId>;
}

/** One build of the plan for a set of knobs. */
interface Built {
	sessions: CramSession[];
	shortfall: number;
	/** New cards no intro day could take. */
	unplaced: CardId[];
}

interface Context {
	input: CramPlanInput;
	standing: Map<CardId, Standing>;
	byId: Map<CardId, CramCard>;
}

function awakeMinutes(input: CramPlanInput): number {
	const { startMin, endMin } = input.sleep;
	const asleep = (endMin - startMin + MINUTES_PER_DAY) % MINUTES_PER_DAY;
	return MINUTES_PER_DAY - asleep;
}

function wrap(minute: number): number {
	return ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

function newOrder(cards: readonly CramCard[]): CramCard[] {
	const high = (card: CramCard): number => (card.priority === 'high' ? 0 : 1);
	return [...cards].sort((a, b) => high(a) - high(b) || compareText(a.id, b.id));
}

/** Intro day per new card, for the days 0..max(0, D−2); the rest are unplaced. */
function introduce(ctx: Context, fresh: readonly CramCard[], knobs: Knobs, meanSec: number) {
	const { input } = ctx;
	const intro = new Map<CardId, number>();
	const queue = newOrder(fresh);
	const lastIntro = Math.max(0, input.daysToExam - 2);
	for (let day = 0; day <= lastIntro && queue.length > 0; day++) {
		const capacityTrials = Math.floor(
			((input.dayMinutes[day] ?? 0) * SECONDS_PER_MINUTE) / meanSec
		);
		const take = newPerDay({
			nNew: fresh.length,
			daysToExam: input.daysToExam,
			criterion: knobs.criterion,
			capacityTrials
		});
		for (const card of queue.splice(0, take)) intro.set(card.id, day);
	}
	return { intro, unplaced: queue.map((card) => card.id) };
}

/** The evening days (before the final pass) a card is reviewed on. */
function repeatDays(ctx: Context, card: CramCard, start: number, relearn: number): number[] {
	const { daysToExam: d, examFormat } = ctx.input;
	const days: number[] = [];
	let day = start;
	while (day < d - 1 && days.length < relearn) {
		days.push(day);
		day += nextGap({
			daysRemaining: d - day,
			examFormat,
			fsrsIntervalDays: card.fsrs?.scheduled_days ?? null,
			weak: card.weak
		});
	}
	return days;
}

function cardMinutesOn(ctx: Context, card: CramCard, isIntro: boolean, criterion: number): number {
	const { calibration, fsrs, now } = ctx.input;
	if (ctx.standing.get(card.id) !== 'new') return reviewMinutes(card, now, calibration, fsrs);
	const attempts = (isIntro ? criterion : 1) / p0For(card.noteType, calibration);
	return attemptMinutes(attempts, card.kind, calibration);
}

function session(
	ctx: Context,
	day: number,
	slot: CramSession['slot'],
	cards: CramCard[],
	fresh: { intro: Map<CardId, number>; criterion: number }
): CramSession {
	const { input } = ctx;
	const isIntro = (card: CramCard): boolean => fresh.intro.get(card.id) === day;
	// Summed in ID order, so the float total doesn't depend on the order cards arrive in.
	const work = [...cards]
		.sort((a, b) => compareText(a.id, b.id))
		.reduce((sum, card) => sum + cardMinutesOn(ctx, card, isIntro(card), fresh.criterion), 0);
	const minutes = withMargin(work);
	const spanMinutes = Math.min(minutes, awakeMinutes(input));
	return {
		day,
		slot,
		startMin: wrap(input.sleep.startMin - spanMinutes),
		minutes,
		spanMinutes,
		cardIds: cramOrder(cards, input.examAt, input.fsrs).result,
		newCardIds: newOrder(cards.filter(isIntro)).map((card) => card.id)
	};
}

function morningSession(ctx: Context, cards: readonly CramCard[]): CramSession | null {
	const { input } = ctx;
	const ids = morningTopUp({
		...input,
		cards,
		failedIds: [],
		minutes: input.examMorningMinutes
	}).result;
	if (ids.length === 0) return null;
	const chosen = ids.flatMap((id) => ctx.byId.get(id) ?? []);
	const work = chosen.reduce(
		(sum, card) => sum + reviewMinutes(card, input.now, input.calibration, input.fsrs),
		0
	);
	const minutes = withMargin(work);
	return {
		day: input.daysToExam,
		slot: 'morning',
		startMin: input.sleep.endMin,
		minutes,
		spanMinutes: Math.min(minutes, awakeMinutes(input)),
		cardIds: ids,
		newCardIds: []
	};
}

/** The cards of each evening session (days before the final pass); secure cards have none. */
function eveningCards(
	ctx: Context,
	planned: readonly CramCard[],
	intro: ReadonlyMap<CardId, number>,
	relearn: number
): Map<number, CramCard[]> {
	const byDay = new Map<number, CramCard[]>();
	for (const card of planned) {
		const standing = ctx.standing.get(card.id);
		if (standing === 'secure') continue;
		const start = standing === 'new' ? (intro.get(card.id) ?? 0) : 0;
		for (const day of repeatDays(ctx, card, start, relearn)) {
			byDay.set(day, [...(byDay.get(day) ?? []), card]);
		}
	}
	return byDay;
}

function build(ctx: Context, knobs: Knobs): Built {
	const { input } = ctx;
	const inScope = input.cards.filter((card) => !knobs.deferred.has(card.id));
	const fresh = inScope.filter((card) => ctx.standing.get(card.id) === 'new');
	const meanSec =
		inScope.reduce((sum, card) => sum + secondsPerAttempt(card.kind, input.calibration), 0) /
		Math.max(1, inScope.length);
	const { intro, unplaced } = introduce(ctx, fresh, knobs, Math.max(meanSec, 1));
	const unplacedSet = new Set(unplaced);
	const planned = inScope.filter((card) => !unplacedSet.has(card.id));
	const byDay = eveningCards(ctx, planned, intro, knobs.relearn);
	const sessions: CramSession[] = [];
	const freshInfo = { intro, criterion: knobs.criterion };
	for (let day = 0; day < input.daysToExam - 1; day++) {
		const cards = byDay.get(day) ?? [];
		if (cards.length > 0) sessions.push(session(ctx, day, 'evening', cards, freshInfo));
	}
	if (input.daysToExam >= 1 && planned.length > 0) {
		sessions.push(session(ctx, input.daysToExam - 1, 'finalPass', planned, freshInfo));
	}
	const morning = morningSession(ctx, planned);
	if (morning) sessions.push(morning);
	return { sessions, shortfall: shortfallOf(input, sessions), unplaced };
}

function shortfallOf(input: CramPlanInput, sessions: readonly CramSession[]): number {
	return sessions
		.filter((s) => s.slot !== 'morning')
		.reduce((sum, s) => sum + Math.max(0, s.minutes - (input.dayMinutes[s.day] ?? 0)), 0);
}

/** New cards in the order the last degrade step defers them: lowest value per minute first. */
function deferOrder(ctx: Context, criterion: number): CardId[] {
	const fresh = ctx.input.cards.filter((card) => ctx.standing.get(card.id) === 'new');
	const ratio = (card: CramCard): number =>
		(PRIORITY_WEIGHT[card.priority] * RETENTION) /
		Math.max(cardMinutesOn(ctx, card, true, criterion), Number.MIN_VALUE);
	return fresh
		.sort((a, b) => ratio(a) - ratio(b) || compareText(a.id, b.id))
		.map((card) => card.id);
}

/** Applies the degrade order until the plan fits or nothing is left to cut. */
function degrade(ctx: Context): {
	built: Built;
	knobs: Knobs;
	steps: Degradation[];
	cut: CardId[];
} {
	let knobs: Knobs = {
		criterion: CRITERION_FIRST,
		relearn: RELEARN_SESSIONS_MAX,
		deferred: new Set()
	};
	let built = build(ctx, knobs);
	const steps: Degradation[] = [];
	const cut: CardId[] = [];
	const retry = (next: Knobs, step: Degradation): void => {
		knobs = next;
		built = build(ctx, knobs);
		if (!steps.includes(step)) steps.push(step);
	};
	if (built.shortfall > 0) retry({ ...knobs, criterion: CRITERION_FIRST_DEGRADED }, 'criterion');
	while (built.shortfall > 0 && knobs.relearn > 1)
		retry({ ...knobs, relearn: knobs.relearn - 1 }, 'relearning');
	for (const id of deferOrder(ctx, knobs.criterion)) {
		if (built.shortfall <= 0) break;
		cut.push(id);
		retry({ ...knobs, deferred: new Set(cut) }, 'deferNew');
	}
	return { built, knobs, steps, cut };
}

/** The day-by-day cram plan, with feasibility and degrading. Deterministic. */
export function planCram(input: CramPlanInput): Traced<CramPlan> {
	const triageTrace: TraceEntry[] = [];
	const standing = new Map<CardId, Standing>();
	for (const card of [...input.cards].sort((a, b) => compareText(a.id, b.id))) {
		const result = triage(card, input.examAt, input.fsrs);
		standing.set(card.id, result.result);
		triageTrace.push(...result.trace);
	}
	const ctx: Context = {
		input,
		standing,
		byId: new Map(input.cards.map((card) => [card.id, card]))
	};
	const { built, knobs, steps, cut } = degrade(ctx);
	const result: CramPlan = {
		sessions: built.sessions,
		feasible: built.shortfall <= 0,
		shortfallMinutes: Math.max(0, built.shortfall),
		degradations: steps,
		deferred: [...cut, ...built.unplaced],
		criterion: knobs.criterion,
		relearnSessions: knobs.relearn,
		standing: Object.fromEntries(standing)
	};
	const summary = {
		rule: 'cram.plan',
		feasible: result.feasible,
		shortfall: result.shortfallMinutes,
		degradations: steps
	};
	return { result, trace: [...triageTrace, summary] };
}
