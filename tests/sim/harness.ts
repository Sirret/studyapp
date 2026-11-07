import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Simulation report files: `test-results/sim/<scenario>.json` (machine-readable, with the seed)
 * and `test-results/sim/<scenario>.md` (a readable day-by-day summary).
 *
 * @see BUILD_PLAN §11.1 (simulation harness) and §11.3 (sim report files)
 */

/** One row of the day-by-day summary: a label per column. */
export type SimRow = Record<string, string | number | boolean>;

/** What happened on one simulated day. */
export interface SimDay {
	day: number;
	/** Short description of the day's session(s). */
	summary: string;
	/** One row per card (or per item of interest). */
	rows: SimRow[];
	/** Anything else worth keeping in the JSON, such as scheduling decisions and their reasons. */
	details?: Record<string, unknown>;
}

export interface SimReport {
	scenario: string;
	passed: boolean;
	seed: number;
	days: SimDay[];
	metrics?: Record<string, number>;
	error?: string;
}

export const SIM_DIR = resolve(process.cwd(), 'test-results', 'sim');

function renderRows(rows: readonly SimRow[]): string[] {
	const first = rows[0];
	if (!first) return ['_(no rows)_'];
	const columns = Object.keys(first);
	const line = (cells: readonly unknown[]) => `| ${cells.map(String).join(' | ')} |`;
	return [
		line(columns),
		line(columns.map(() => '---')),
		...rows.map((row) => line(columns.map((column) => row[column] ?? '')))
	];
}

/** The readable summary of a run. */
export function renderMarkdown(report: SimReport): string {
	const lines = [
		`# Sim scenario: ${report.scenario}`,
		'',
		`- Verdict: **${report.passed ? 'passed' : 'FAILED'}**`,
		`- Seed: ${report.seed}`
	];
	if (report.error) lines.push(`- Error: ${report.error}`);
	for (const [name, value] of Object.entries(report.metrics ?? {})) {
		lines.push(`- ${name}: ${value}`);
	}
	for (const day of report.days) {
		lines.push('', `## Day ${day.day}`, '', day.summary, '', ...renderRows(day.rows));
	}
	return `${lines.join('\n')}\n`;
}

/** Writes both report files, creating `test-results/sim/` if needed. Returns their paths. */
export function writeSimReport(
	report: SimReport,
	dir: string = SIM_DIR
): { json: string; md: string } {
	mkdirSync(dir, { recursive: true });
	const json = join(dir, `${report.scenario}.json`);
	const md = join(dir, `${report.scenario}.md`);
	writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`);
	writeFileSync(md, renderMarkdown(report));
	return { json, md };
}
