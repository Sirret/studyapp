import { EXAM_READY_DAYS, SECURE_STABILITY_DAYS } from '#lib/config/defaults.ts';
import type { CardStatus } from '#lib/db/schemas/common.ts';
import type { Traced } from './trace.ts';

/**
 * The study days of one card's counting events (credited first attempts, not `none` weight), for
 * `daysCorrect` and lapses. Day numbers come from `dayIndex`.
 */
export interface DayTally {
	/** Day of the first counting event, or null before any. */
	firstDay: number | null;
	/** Days that have had a counting event, ascending. */
	seenDays: number[];
	/** Days with a counting correct after the last lapse day, ascending; its length is `daysCorrect`. */
	countedDays: number[];
	/** Day of the last lapse, or null if none. */
	lapseDay: number | null;
}

/** No counting events yet. */
export const EMPTY_DAY_TALLY: DayTally = {
	firstDay: null,
	seenDays: [],
	countedDays: [],
	lapseDay: null
};

/**
 * Folds one counting event in. A wrong first counting event of a day after `firstDay` is a lapse:
 * it clears `countedDays`, and that day can't count. Otherwise a correct adds its day.
 *
 * @see BUILD_PLAN §6.5 and Decisions log (daysCorrect and lapses)
 */
export function tallyDay(tally: DayTally, answer: { day: number; correct: boolean }): DayTally {
	const { day, correct } = answer;
	const firstDay = tally.firstDay ?? day;
	const isFirstOfDay = !tally.seenDays.includes(day);
	const seenDays = isFirstOfDay ? withDay(tally.seenDays, day) : tally.seenDays;
	if (isFirstOfDay && day > firstDay && !correct) {
		return { firstDay, seenDays, countedDays: [], lapseDay: day };
	}
	const afterLapse = tally.lapseDay === null || day > tally.lapseDay;
	const counts = correct && afterLapse && !tally.countedDays.includes(day);
	const countedDays = counts ? withDay(tally.countedDays, day) : tally.countedDays;
	return { firstDay, seenDays, countedDays, lapseDay: tally.lapseDay };
}

function withDay(days: readonly number[], day: number): number[] {
	return [...days, day].sort((a, b) => a - b);
}

/** What replay knows about a card when it picks its status. */
export interface StatusFacts {
	/** Has any review event (pretests and self-rated alone don't count). */
	reviewed: boolean;
	/** Has any counting event. */
	counted: boolean;
	/** Every counting event was in `onenight` mode. */
	onlyOneNight: boolean;
	daysCorrect: number;
	/** The last counting event was correct. */
	lastCorrect: boolean;
	/** FSRS stability in days, or null with no FSRS state. */
	stability: number | null;
	fragile: boolean;
	/** The latest credited session was `cram` mode and met its criterion. */
	cramCriterionMet: boolean;
}

/**
 * The status label, first rule that holds: unseen → learning → one-night → needs-work → secure →
 * exam-ready → provisional.
 *
 * @see BUILD_PLAN §6.5, CONCEPT §7 (card states) and Decisions log (status)
 */
export function deriveStatus(facts: StatusFacts): Traced<CardStatus> {
	const rule = STATUS_RULES.find(([, holds]) => holds(facts));
	const status = rule ? rule[0] : 'provisional';
	return {
		result: status,
		trace: [{ rule: 'status', status, daysCorrect: facts.daysCorrect, fragile: facts.fragile }]
	};
}

const isSecure = (facts: StatusFacts): boolean =>
	facts.stability !== null &&
	facts.stability >= SECURE_STABILITY_DAYS &&
	!facts.fragile &&
	facts.lastCorrect;

const isExamReady = (facts: StatusFacts): boolean =>
	facts.lastCorrect && (facts.daysCorrect >= EXAM_READY_DAYS || facts.cramCriterionMet);

/** Checked in order; the first that holds wins, and `provisional` is the fallback. */
const STATUS_RULES: readonly (readonly [CardStatus, (facts: StatusFacts) => boolean])[] = [
	['unseen', (facts) => !facts.reviewed],
	['learning', (facts) => !facts.counted],
	['one-night', (facts) => facts.onlyOneNight],
	['needs-work', (facts) => facts.daysCorrect === 0],
	['secure', isSecure],
	['exam-ready', isExamReady]
];
