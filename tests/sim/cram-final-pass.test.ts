import { describe, expect, it } from 'vitest';
import type { CardId } from '#lib/db/schemas/common.ts';
import { planCram, type CramCard, type CramPlan } from '#lib/engine/cram.ts';
import {
	AT_RISK,
	cramCard,
	planInput,
	SECURE,
	SLEEP_AFTER_MIDNIGHT,
	SLEEP_CROSSING
} from '../unit/engine/cram-fixtures.ts';
import { writeSimReport, type SimDay, type SimReport } from './harness.ts';

/**
 * Scenario "cram-final-pass" (SESSION_NOTES A5): the exam is tomorrow (D = 1) and the student has
 * read topics whose cards were never seen. Every read-but-unseen card must reach tonight's final
 * pass, or be listed as deferred (the plan says what it left out). Never silently dropped.
 *
 * @see BUILD_PLAN §6.6 ("The plan, concretely": D = 1) and Decisions log (Fix pass: D = 1 final pass)
 */

const SCENARIO = 'cram-final-pass';
/** No randomness is involved; the seed only labels the report. */
const SEED = 0;
const BUDGETS: Record<string, number> = { generous: 600, tight: 15, none: 0 };
const WINDOWS = { crossing: SLEEP_CROSSING, afterMidnight: SLEEP_AFTER_MIDNIGHT };

/** Read-but-unseen cards (no FSRS state) next to some reviewed ones. */
function deck(unseen: number): CramCard[] {
	const fresh = Array.from({ length: unseen }, (_, i) =>
		cramCard(100 + i, { priority: i % 4 === 0 ? 'high' : 'normal' })
	);
	return [...fresh, cramCard(1, { fsrs: AT_RISK }), cramCard(2, { fsrs: SECURE })];
}

interface Outcome {
	label: string;
	plan: CramPlan;
	unseen: CardId[];
	inFinalPass: CardId[];
	missing: CardId[];
}

function run(budget: string, window: keyof typeof WINDOWS, unseen: number): Outcome {
	const cards = deck(unseen);
	const input = planInput(1, cards, {
		dayMinutes: [BUDGETS[budget] ?? 0],
		sleep: WINDOWS[window]
	});
	const plan = planCram(input).result;
	const finalPass = plan.sessions.find((s) => s.slot === 'finalPass');
	const ids = cards.filter((c) => c.fsrs === null).map((c) => c.id);
	const inFinalPass = ids.filter((id) => finalPass?.cardIds.includes(id) ?? false);
	const missing = ids.filter((id) => !inFinalPass.includes(id) && !plan.deferred.includes(id));
	return { label: `${budget}/${window}/${unseen}`, plan, unseen: ids, inFinalPass, missing };
}

function runScenario(): SimReport {
	const outcomes: Outcome[] = [];
	for (const budget of Object.keys(BUDGETS))
		for (const window of Object.keys(WINDOWS) as (keyof typeof WINDOWS)[])
			for (const unseen of [1, 8, 40]) outcomes.push(run(budget, window, unseen));
	const day: SimDay = {
		day: 0,
		summary: 'D = 1: tonight is the final pass; tomorrow is the exam.',
		rows: outcomes.map((o) => ({
			case: o.label,
			unseen: o.unseen.length,
			inFinalPass: o.inFinalPass.length,
			deferred: o.plan.deferred.length,
			missing: o.missing.length,
			feasible: o.plan.feasible,
			shortfallMinutes: Math.round(o.plan.shortfallMinutes)
		}))
	};
	const missing = outcomes.reduce((sum, o) => sum + o.missing.length, 0);
	return {
		scenario: SCENARIO,
		passed: missing === 0,
		seed: SEED,
		days: [day],
		metrics: { cases: outcomes.length, missing }
	};
}

describe(`sim: ${SCENARIO}`, () => {
	it('puts every read-but-unseen card in the final pass or lists it as deferred, for every budget', () => {
		let report: SimReport;
		try {
			report = runScenario();
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
		expect(report.error ?? '').toBe('');
		expect(report.passed).toBe(true);
	});

	it('with a generous evening, every unseen card is in the final pass and nothing is deferred', () => {
		for (const window of Object.keys(WINDOWS) as (keyof typeof WINDOWS)[]) {
			const o = run('generous', window, 40);
			expect(o.inFinalPass).toStrictEqual(o.unseen);
			expect(o.plan.deferred).toStrictEqual([]);
		}
	});

	it('when time is short, what is left out is listed as deferred and the plan flags it', () => {
		const o = run('none', 'crossing', 8);
		expect(o.missing).toStrictEqual([]);
		expect(o.plan.deferred.length + o.inFinalPass.length).toBe(o.unseen.length);
		if (o.plan.deferred.length > 0) expect(o.plan.degradations).toContain('deferNew');
	});
});
