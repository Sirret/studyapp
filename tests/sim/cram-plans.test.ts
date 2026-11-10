import { describe, expect, it } from 'vitest';
import { NEW_SHARE_MAX } from '#lib/config/defaults.ts';
import { planCram, type CramPlan, type CramPlanInput, type SleepWindow } from '#lib/engine/cram.ts';
import { secondsPerAttempt } from '#lib/engine/estimate.ts';
import {
	inSleep,
	MINUTES_PER_DAY,
	mixedDeck,
	planInput,
	SLEEP_AFTER_MIDNIGHT,
	SLEEP_CROSSING,
	sleepLength
} from '../unit/engine/cram-fixtures.ts';
import { writeSimReport, type SimDay, type SimReport, type SimRow } from './harness.ts';

/**
 * Scenario "cram plans": cram plans for exams 0…7 days away, under two sleep windows (one crossing
 * midnight, one not) and three budgets (generous, tight, none). Every plan must be feasible or
 * flagged with its shortfall, identical (trace included) when planned twice, keep every session
 * outside the sleep window, and give the documented D = 0, 1 and 2 shapes.
 *
 * @see BUILD_PLAN §6.6 ("The plan, concretely", Done when) and Decisions log (Phase 7: cram plans)
 */

const SCENARIO = 'cram-plans';
/** No randomness is involved; the seed only labels the report. */
const SEED = 0;
const WINDOWS: Record<string, SleepWindow> = {
	crossing: SLEEP_CROSSING,
	afterMidnight: SLEEP_AFTER_MIDNIGHT
};
const BUDGETS: Record<string, number> = { generous: 600, tight: 12, none: 0 };
const MAX_D = 7;

interface Case {
	d: number;
	window: string;
	budget: string;
	input: CramPlanInput;
}

function cases(): Case[] {
	const out: Case[] = [];
	for (let d = 0; d <= MAX_D; d += 1) {
		for (const [window, sleep] of Object.entries(WINDOWS)) {
			for (const [budget, minutes] of Object.entries(BUDGETS)) {
				const dayMinutes = Array.from({ length: d }, () => minutes);
				out.push({ d, window, budget, input: planInput(d, mixedDeck(), { sleep, dayMinutes }) });
			}
		}
	}
	return out;
}

/** Every problem found with one plan; empty when it meets the spec. */
function problems(c: Case, plan: CramPlan, again: unknown): string[] {
	const found: string[] = [];
	const { d, input } = c;
	const sleep = input.sleep;
	const awake = MINUTES_PER_DAY - sleepLength(sleep);
	if (JSON.stringify(again) !== JSON.stringify(planCram(input))) found.push('not deterministic');
	const perDay = Array.from({ length: d }, (_, day) =>
		plan.sessions
			.filter((s) => s.day === day && s.slot !== 'morning')
			.reduce((sum, s) => sum + s.minutes, 0)
	);
	const fits = perDay.every((m, day) => m <= input.dayMinutes[day]!);
	if (plan.feasible !== fits) found.push(`feasible=${plan.feasible} but days fit=${fits}`);
	if (plan.feasible && plan.shortfallMinutes !== 0) found.push('feasible with a shortfall');
	if (!plan.feasible && !(plan.shortfallMinutes > 0)) found.push('infeasible without a shortfall');
	for (const s of plan.sessions) {
		const where = `day ${s.day} ${s.slot}`;
		if (s.spanMinutes > awake) found.push(`${where}: span over the awake time`);
		if (s.spanMinutes > s.minutes + 1e-9) found.push(`${where}: span over its minutes`);
		for (let m = 0; m < s.spanMinutes; m += 1) {
			if (inSleep(s.startMin + m, sleep)) {
				found.push(`${where}: overlaps the sleep window at +${m} min`);
				break;
			}
		}
		const end = (s.startMin + s.spanMinutes) % MINUTES_PER_DAY;
		if (s.slot === 'morning') {
			if (s.startMin !== sleep.endMin) found.push(`${where}: does not start at wake-up`);
			if (s.spanMinutes > input.examMorningMinutes)
				found.push(`${where}: longer than examMorningMinutes`);
			if (s.newCardIds.length > 0) found.push(`${where}: introduces new cards on exam day`);
		} else if (Math.abs(end - sleep.startMin) > 1e-6) {
			found.push(`${where}: does not end at the sleep window start`);
		}
		if (d >= 3 && s.day > d - 2 && s.newCardIds.length > 0)
			found.push(`${where}: new cards after D−2`);
		const sec = input.cards.map((card) => secondsPerAttempt(card.kind, input.calibration));
		const meanSec = sec.reduce((a, b) => a + b, 0) / sec.length;
		const capacity = s.day < d ? (input.dayMinutes[s.day]! * 60) / meanSec : 0;
		if (s.newCardIds.length * plan.criterion > NEW_SHARE_MAX * capacity + 1e-9) {
			found.push(`${where}: new trials over NEW_SHARE_MAX of capacity`);
		}
	}
	const introduced = plan.sessions.flatMap((s) => s.newCardIds);
	const newIds = input.cards.filter((card) => card.fsrs === null).map((card) => card.id);
	const accounted = [...introduced, ...plan.deferred].sort();
	if (JSON.stringify(accounted) !== JSON.stringify([...newIds].sort())) {
		found.push('new cards not each introduced once or deferred');
	}
	for (const card of input.cards) {
		const evenings = plan.sessions.filter(
			(s) => s.slot === 'evening' && s.cardIds.includes(card.id)
		).length;
		if (evenings > plan.relearnSessions)
			found.push(`${card.id}: more than K sessions before the final pass`);
	}
	return found;
}

/** The documented session slots. D ≤ 2 are §6.6's named shapes. */
function expectedSlots(d: number): string[] {
	if (d === 0) return ['0:morning'];
	const evenings = Array.from({ length: Math.max(0, d - 1) }, (_, day) => `${day}:evening`);
	return [...evenings, `${d - 1}:finalPass`, `${d}:morning`];
}

const slotsOf = (plan: CramPlan) => plan.sessions.map((s) => `${s.day}:${s.slot}`);

function runScenario(): SimReport {
	const days: SimDay[] = [];
	const all: string[] = [];
	for (let d = 0; d <= MAX_D; d += 1) {
		const rows: SimRow[] = [];
		for (const c of cases().filter((x) => x.d === d)) {
			const traced = planCram(c.input);
			const plan = traced.result;
			const found = problems(c, plan, traced);
			const got = slotsOf(plan);
			// D = 0, 1, 2 shapes are checked here; the D ≥ 3 shape has its own test below.
			if (d <= 2 && JSON.stringify(got) !== JSON.stringify(expectedSlots(d))) {
				found.push(`shape ${got.join(',')}`);
			}
			all.push(...found.map((f) => `D=${d} ${c.window} ${c.budget}: ${f}`));
			rows.push({
				window: c.window,
				budget: c.budget,
				feasible: plan.feasible,
				shortfall: Number(plan.shortfallMinutes.toFixed(2)),
				sessions: got.join(' '),
				degradations: plan.degradations.join(',') || 'none',
				deferred: plan.deferred.length,
				problems: found.length
			});
		}
		days.push({ day: d, summary: `Exam ${d} day(s) away`, rows });
	}
	return {
		scenario: SCENARIO,
		passed: all.length === 0,
		seed: SEED,
		days,
		metrics: { problems: all.length },
		...(all.length ? { error: all.slice(0, 20).join('; ') } : {})
	};
}

describe(`sim: ${SCENARIO}`, () => {
	it('plans D = 0…7 feasible-or-flagged, deterministically, outside the sleep window, in the documented shapes', () => {
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

	it('plans evenings only on days 0..D−2 that have cards, then a final pass on D−1 and the morning on D, for D ≥ 3 and every budget', () => {
		for (const c of cases().filter((x) => x.d >= 3)) {
			const label = `D=${c.d} ${c.window} ${c.budget}`;
			const sessions = planCram(c.input).result.sessions;
			const evenings = sessions.filter((s) => s.slot === 'evening');
			const days = evenings.map((s) => s.day);
			expect(
				days.every((day) => day >= 0 && day <= c.d - 2),
				label
			).toBe(true);
			expect(new Set(days).size, `${label}: one evening per day`).toBe(days.length);
			expect(days, `${label}: evenings in day order`).toStrictEqual(
				[...days].sort((a, b) => a - b)
			);
			expect(
				evenings.every((s) => s.cardIds.length > 0),
				`${label}: no empty evening`
			).toBe(true);
			expect(
				slotsOf({ sessions: sessions.slice(evenings.length) } as CramPlan),
				label
			).toStrictEqual([`${c.d - 1}:finalPass`, `${c.d}:morning`]);
		}
	});

	it('returns an identical plan and trace on a second call, for every case', () => {
		for (const c of cases()) expect(planCram(c.input)).toStrictEqual(planCram(c.input));
	});

	it('flags the no-time budget as infeasible for every D ≥ 1', () => {
		for (const c of cases().filter((x) => x.budget === 'none' && x.d >= 1)) {
			const plan = planCram(c.input).result;
			expect(plan.feasible).toBe(false);
			expect(plan.shortfallMinutes).toBeGreaterThan(0);
		}
	});

	it('finds the generous budget feasible for every D', () => {
		for (const c of cases().filter((x) => x.budget === 'generous')) {
			expect(planCram(c.input).result.feasible).toBe(true);
		}
	});
});
