import { ONENIGHT_BREAK_MIN, ONENIGHT_MIN_BLOCK_MIN, RETENTION } from '#lib/config/defaults.ts';
import type { CardId, Priority } from '#lib/db/schemas/common.ts';
import { compareText } from './replay.ts';
import type { Traced, TraceEntry } from './trace.ts';
import { valuePerMinute as worthPerMinute } from './value.ts';

/**
 * One-night mode (exam tomorrow, from cold): triage units by value per minute into tonight's
 * time, block 1 (quick-path acquisition), a break, block 2 (mixed re-quiz), the sleep reminder and
 * the exam-morning check.
 *
 * @see BUILD_PLAN §6.8, CONCEPT §9 and Decisions log (Phase 7: one-night)
 */

/** An acquisition unit as one-night triage sees it. */
export interface NightUnit {
	key: string;
	priority: Priority;
	/** Quick-path block-1 minutes (`unitCost`). */
	minutes: number;
	/** Mean `p0` of its cards: lower is harder from cold. */
	ease: number;
	cardIds: readonly CardId[];
}

export interface OneNightPlan {
	/** Block 1: the chosen units, in triage order. */
	chosen: string[];
	/** Units left out, in triage order. */
	skipped: string[];
	breakMinutes: number;
	/** Block 2: every chosen card, round-robin across the chosen units. */
	block2: CardId[];
	/** The exam-morning check: the same cards as block 2, in the same order. */
	morning: CardId[];
	/** Planned minutes tonight: block 1 + break + block 2. */
	minutes: number;
	/** Every unit fitted. */
	complete: boolean;
	/**
	 * No unit fitted the time given (late, or past the sleep start), so this is the minimum
	 * `ONENIGHT_MIN_BLOCK_MIN` block; the screen shows the sleep reminder with it.
	 */
	minimumBlock: boolean;
}

const SECONDS_PER_MINUTE = 60;

/** The shared value formula: a unit is its cards as new cards (R_exam = 0). */
function valuePerMinute(unit: NightUnit): number {
	const valued = { priority: unit.priority, rExam: 0, cards: unit.cardIds.length };
	return worthPerMinute(valued, RETENTION, unit.minutes);
}

/** Value per minute highest first, ties easier first, then key. */
function triageOrder(units: readonly NightUnit[]): NightUnit[] {
	return [...units].sort(
		(a, b) => valuePerMinute(b) - valuePerMinute(a) || b.ease - a.ease || compareText(a.key, b.key)
	);
}

/** Every card of the units, taking one from each unit in turn. */
function roundRobin(units: readonly NightUnit[]): CardId[] {
	const out: CardId[] = [];
	const longest = Math.max(0, ...units.map((unit) => unit.cardIds.length));
	for (let i = 0; i < longest; i++) {
		for (const unit of units) {
			const id = unit.cardIds[i];
			if (id !== undefined) out.push(id);
		}
	}
	return out;
}

interface Fit {
	chosen: NightUnit[];
	skipped: NightUnit[];
	blockOne: number;
	cards: number;
}

/** Block 1 + break + block 2 for these minutes and cards. */
function tonight(minutes: number, count: number, secPerCard: number): number {
	return minutes + ONENIGHT_BREAK_MIN + (count * secPerCard) / SECONDS_PER_MINUTE;
}

/** Greedy fit in triage order; with `forceFirst`, the first unit is taken even if it doesn't fit. */
function fit(
	ordered: readonly NightUnit[],
	available: number,
	secPerCard: number,
	forceFirst: boolean
): Fit {
	const out: Fit = { chosen: [], skipped: [], blockOne: 0, cards: 0 };
	for (const unit of ordered) {
		const total = tonight(out.blockOne + unit.minutes, out.cards + unit.cardIds.length, secPerCard);
		if (total <= available || (forceFirst && out.chosen.length === 0)) {
			out.chosen.push(unit);
			out.blockOne += unit.minutes;
			out.cards += unit.cardIds.length;
		} else out.skipped.push(unit);
	}
	return out;
}

/**
 * Plans tonight. Triage order: value per minute (the shared `valueOf`, a unit counting as its
 * cards with R_exam = 0) highest first, ties easier first (higher `ease`), then key. Greedy: a unit
 * is chosen when block 1 + its minutes + `ONENIGHT_BREAK_MIN` + block 2 (one attempt per chosen
 * card at `blockTwoSecPerCard`) still fit `availableMinutes`; otherwise it is skipped and the next
 * one is tried. When no unit fits at all (late, or past the sleep start), the plan is a minimum
 * block: the same greedy fit in `ONENIGHT_MIN_BLOCK_MIN`, taking at least the first unit.
 *
 * @see BUILD_PLAN §6.8 and Decisions log (Fix pass: one-night minimum block)
 */
export function planOneNight(input: {
	units: readonly NightUnit[];
	availableMinutes: number;
	blockTwoSecPerCard: number;
}): Traced<OneNightPlan> {
	const ordered = triageOrder(input.units);
	const sec = input.blockTwoSecPerCard;
	let picked = fit(ordered, input.availableMinutes, sec, false);
	const minimumBlock = picked.chosen.length === 0 && ordered.length > 0;
	if (minimumBlock) picked = fit(ordered, ONENIGHT_MIN_BLOCK_MIN, sec, true);
	const { chosen, skipped } = picked;
	const block2 = roundRobin(chosen);
	const result: OneNightPlan = {
		chosen: chosen.map((unit) => unit.key),
		skipped: skipped.map((unit) => unit.key),
		breakMinutes: ONENIGHT_BREAK_MIN,
		block2,
		morning: [...block2],
		minutes: chosen.length === 0 ? 0 : tonight(picked.blockOne, picked.cards, sec),
		complete: skipped.length === 0,
		minimumBlock
	};
	const trace: TraceEntry[] = [
		{ rule: 'onenight.triage', chosen: result.chosen, skipped: result.skipped },
		{ rule: 'onenight.minutes', minutes: result.minutes, available: input.availableMinutes }
	];
	if (minimumBlock) {
		trace.push({ rule: 'onenight.minimumBlock', minutes: ONENIGHT_MIN_BLOCK_MIN });
	}
	return { result, trace };
}
