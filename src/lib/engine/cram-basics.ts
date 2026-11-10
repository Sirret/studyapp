import { ALPHA, NEW_SHARE_MAX, SECURE_AT_EXAM } from '#lib/config/defaults.ts';
import type { FsrsCardState } from '#lib/db/schemas/card.ts';
import type { CardId, ExamFormat, ExerciseKind, Priority } from '#lib/db/schemas/common.ts';
import type { NoteType } from '#lib/db/schemas/note.ts';
import {
	attemptMinutes,
	recallFor,
	withMargin,
	type Calibration,
	type Standing
} from './estimate.ts';
import { retrievabilityAt, type FsrsConfig } from './fsrs.ts';
import { compareText } from './replay.ts';
import type { Traced } from './trace.ts';

/**
 * Cram mode's building blocks: triage by recall at exam time, weakest-first queue order, the
 * next-session gap, new cards per day and the morning top-up. `cram.ts` builds the plan from them.
 *
 * @see BUILD_PLAN §6.6, CONCEPT §7 and Decisions log (Phase 7: cram plan)
 */

/** A card in a cram plan. */
export interface CramCard {
	id: CardId;
	kind: ExerciseKind;
	noteType: NoteType;
	fsrs: FsrsCardState | null;
	weak: boolean;
	priority: Priority;
}

/** A local time span as minutes after midnight; `start > end` crosses midnight. */
export interface SleepWindow {
	startMin: number;
	endMin: number;
}

export interface CramPlanInput {
	cards: readonly CramCard[];
	/** Days from today (0) to the exam day (D ≥ 0; 0 plans only the morning top-up). */
	daysToExam: number;
	examFormat: ExamFormat;
	/** When the exam starts (epoch ms), for `R_exam`. */
	examAt: number;
	/** When planning happens (epoch ms), for `R(t)` of today's reviews. */
	now: number;
	/** Available minutes for days 0..D−1 (length D). */
	dayMinutes: readonly number[];
	/** Minutes available on exam morning (day D). */
	examMorningMinutes: number;
	sleep: SleepWindow;
	calibration: Calibration;
	fsrs: FsrsConfig;
}

/** One planned session. `evening` and `finalPass` sessions end at the sleep window's start. */
export interface CramSession {
	/** 0 = today; D = exam day. */
	day: number;
	slot: 'evening' | 'finalPass' | 'morning';
	/** Local start, in minutes after midnight (wraps past midnight as `% 1440`). */
	startMin: number;
	/** Planned minutes, safety margin included (can exceed the day's time when infeasible). */
	minutes: number;
	/** Minutes actually blocked out: `minutes`, at most the awake time outside the sleep window. */
	spanMinutes: number;
	/** In cram queue order (`cramOrder`). */
	cardIds: CardId[];
	/** The cards introduced in this session (a subset of `cardIds`). */
	newCardIds: CardId[];
}

/** A degrade step, applied in this order. */
export type Degradation = 'criterion' | 'relearning' | 'deferNew';

export interface CramPlan {
	sessions: CramSession[];
	/** Every planned day fits its available minutes. */
	feasible: boolean;
	/** Minutes over the available time, summed over days (0 when feasible). */
	shortfallMinutes: number;
	degradations: Degradation[];
	/** New cards left out by the last degrade step, lowest value per minute first. */
	deferred: CardId[];
	/** First-session criterion used for new cards (3, or 2 after degrading). */
	criterion: number;
	/** Most sessions per card before the final pass (K). */
	relearnSessions: number;
	standing: Record<CardId, Standing>;
}

/** `R_exam ≥ SECURE_AT_EXAM` → secure; reviewed but below → at-risk; no FSRS state → new. */
export function triage(card: CramCard, examAt: number, fsrs: FsrsConfig): Traced<Standing> {
	const rExam = retrievabilityAt(card.fsrs, examAt, fsrs);
	const result: Standing =
		card.fsrs === null ? 'new' : rExam >= SECURE_AT_EXAM ? 'secure' : 'at-risk';
	return { result, trace: [{ rule: 'cram.triage', cardId: card.id, rExam, standing: result }] };
}

/**
 * New cards per day: `ceil(nNew / max(1, D − 1))`, capped so new trials (cards × criterion)
 * stay within `NEW_SHARE_MAX` × the session's trial capacity.
 */
export function newPerDay(input: {
	nNew: number;
	daysToExam: number;
	criterion: number;
	capacityTrials: number;
}): number {
	if (input.nNew <= 0) return 0;
	const spread = Math.ceil(input.nNew / Math.max(1, input.daysToExam - 1));
	const cap = Math.floor((NEW_SHARE_MAX * input.capacityTrials) / input.criterion);
	return Math.max(0, Math.min(spread, cap));
}

/** Cram queue order: priority `1 − R_exam`, lowest recall first, ties by card ID. */
export function cramOrder(
	cards: readonly CramCard[],
	examAt: number,
	fsrs: FsrsConfig
): Traced<CardId[]> {
	const scored = cards.map((card) => ({
		id: card.id,
		priority: 1 - retrievabilityAt(card.fsrs, examAt, fsrs)
	}));
	scored.sort((a, b) => b.priority - a.priority || compareText(a.id, b.id));
	return {
		result: scored.map((entry) => entry.id),
		trace: [{ rule: 'cram.order', cards: scored.length }]
	};
}

/**
 * Days to the card's next cram session: `clamp(round(α × daysRemaining), 1, max(1,
 * daysRemaining − 1))`, then at most the FSRS interval (when known); weak cards get 1.
 */
export function nextGap(input: {
	daysRemaining: number;
	examFormat: ExamFormat;
	fsrsIntervalDays: number | null;
	weak: boolean;
}): number {
	if (input.weak) return 1;
	const upper = Math.max(1, input.daysRemaining - 1);
	const gap = Math.min(
		upper,
		Math.max(1, Math.round(ALPHA[input.examFormat] * input.daysRemaining))
	);
	if (input.fsrsIntervalDays === null) return gap;
	return Math.max(1, Math.min(gap, Math.round(input.fsrsIntervalDays)));
}

/** Minutes of one review of a card already seen, `1 / R(at)`, without the margin. */
export function reviewMinutes(
	card: CramCard,
	at: number,
	calibration: Calibration,
	fsrs: FsrsConfig
): number {
	return attemptMinutes(1 / recallFor(card, at, calibration, fsrs), card.kind, calibration);
}

/**
 * The exam-morning top-up: last night's failures first (in the given order), then the lowest
 * `R_exam` cards, until the minutes run out. Never more than the cards given.
 */
export function morningTopUp(input: {
	cards: readonly CramCard[];
	failedIds: readonly CardId[];
	minutes: number;
	examAt: number;
	now: number;
	calibration: Calibration;
	fsrs: FsrsConfig;
}): Traced<CardId[]> {
	const byId = new Map(input.cards.map((card) => [card.id, card]));
	const failed = [...new Set(input.failedIds)].filter((id) => byId.has(id));
	const rest = cramOrder(input.cards, input.examAt, input.fsrs).result.filter(
		(id) => !failed.includes(id)
	);
	const chosen: CardId[] = [];
	let used = 0;
	for (const id of [...failed, ...rest]) {
		const card = byId.get(id);
		if (!card) continue;
		const cost = reviewMinutes(card, input.now, input.calibration, input.fsrs);
		if (withMargin(used + cost) > input.minutes) break;
		used += cost;
		chosen.push(id);
	}
	return {
		result: chosen,
		trace: [{ rule: 'cram.morning', failed: failed.length, chosen: chosen.length }]
	};
}
