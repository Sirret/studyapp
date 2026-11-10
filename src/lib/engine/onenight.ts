import { ONENIGHT_BREAK_MIN, PRIORITY_WEIGHT } from '#lib/config/defaults.ts';
import type { CardId, Priority } from '#lib/db/schemas/common.ts';
import { compareText } from './replay.ts';
import type { Traced } from './trace.ts';

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
}

const SECONDS_PER_MINUTE = 60;

function valuePerMinute(unit: NightUnit): number {
	return PRIORITY_WEIGHT[unit.priority] / Math.max(unit.minutes, Number.MIN_VALUE);
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

/**
 * Plans tonight. Triage order: value per minute (`PRIORITY_WEIGHT[priority] / minutes`) highest
 * first, ties easier first (higher `ease`), then key. Greedy: a unit is chosen when block 1 + its
 * minutes + `ONENIGHT_BREAK_MIN` + block 2 (one attempt per chosen card at `blockTwoSecPerCard`)
 * still fit `availableMinutes`; otherwise it is skipped and the next one is tried.
 */
export function planOneNight(input: {
	units: readonly NightUnit[];
	availableMinutes: number;
	blockTwoSecPerCard: number;
}): Traced<OneNightPlan> {
	const chosen: NightUnit[] = [];
	const skipped: NightUnit[] = [];
	let blockOne = 0;
	let cards = 0;
	const tonight = (minutes: number, count: number): number =>
		minutes + ONENIGHT_BREAK_MIN + (count * input.blockTwoSecPerCard) / SECONDS_PER_MINUTE;
	for (const unit of triageOrder(input.units)) {
		const fits =
			tonight(blockOne + unit.minutes, cards + unit.cardIds.length) <= input.availableMinutes;
		if (fits) {
			chosen.push(unit);
			blockOne += unit.minutes;
			cards += unit.cardIds.length;
		} else skipped.push(unit);
	}
	const block2 = roundRobin(chosen);
	const result: OneNightPlan = {
		chosen: chosen.map((unit) => unit.key),
		skipped: skipped.map((unit) => unit.key),
		breakMinutes: ONENIGHT_BREAK_MIN,
		block2,
		morning: [...block2],
		minutes: chosen.length === 0 ? 0 : tonight(blockOne, cards),
		complete: skipped.length === 0
	};
	return {
		result,
		trace: [
			{ rule: 'onenight.triage', chosen: result.chosen, skipped: result.skipped },
			{ rule: 'onenight.minutes', minutes: result.minutes, available: input.availableMinutes }
		]
	};
}
