import type { BundleReport } from './bundle.ts';

/** The fields read from Vitest's JSON reporter (`test-results/unit.json`). */
export interface VitestReport {
	numTotalTests: number;
	numPassedTests: number;
	numFailedTests: number;
	numPendingTests: number;
	testResults: {
		name: string;
		/** A file that failed before any test ran (for example a compile error). */
		message?: string;
		status: string;
		assertionResults: {
			fullName: string;
			status: string;
			failureMessages: string[];
			location?: { line: number; column: number } | null;
		}[];
	}[];
}

/** One coverage metric from `coverage/coverage-summary.json`. */
export interface CoverageMetric {
	total: number;
	covered: number;
	pct: number;
}

/** `coverage/coverage-summary.json`: `total` plus one record per absolute file path. */
export type CoverageSummary = Record<string, { lines: CoverageMetric; branches: CoverageMetric }>;

/** A minimum for the files under one source directory. */
export interface CoverageThreshold {
	/** Directory prefix with forward slashes, e.g. `src/lib/engine/`. */
	dir: string;
	min: number;
}

/** The fields read from Playwright's JSON reporter (`test-results/e2e.json`). */
export interface PlaywrightSuite {
	file?: string;
	specs?: {
		title: string;
		ok: boolean;
		file: string;
		line: number;
		tests: { results: { error?: { message?: string } }[] }[];
	}[];
	suites?: PlaywrightSuite[];
}
export interface PlaywrightReport {
	stats: { expected: number; unexpected: number; flaky: number; skipped: number };
	suites: PlaywrightSuite[];
}

/** The verdict a sim scenario writes to `test-results/sim/<scenario>.json`. */
export interface SimVerdict {
	scenario: string;
	passed: boolean;
	seed: number;
}

/** What `npm run verify` writes to `test-results/verify.json`. */
export interface VerifyReport {
	steps: { name: string; passed: boolean; durationMs: number }[];
}

/** Every report found on disk. A report that is missing is `undefined`, never an error. */
export interface SummaryInput {
	/** Text for the header; passed in so the output is deterministic. */
	generatedAt: string;
	/** Project root with forward slashes, stripped from paths in the output. */
	rootDir: string;
	verify?: VerifyReport;
	unit?: VitestReport;
	coverage?: CoverageSummary;
	thresholds: CoverageThreshold[];
	bundle?: BundleReport;
	sim: SimVerdict[];
	e2e?: PlaywrightReport;
}

const NOT_RUN = '_not run_';
const MAX_FAILURE_CHARS = 400;

function relative(file: string, rootDir: string): string {
	const normal = file.replaceAll('\\', '/');
	return normal.startsWith(`${rootDir}/`) ? normal.slice(rootDir.length + 1) : normal;
}

function excerpt(message: string | undefined): string {
	return (message ?? '').trim().slice(0, MAX_FAILURE_CHARS);
}

function verifySection(verify: VerifyReport | undefined): string[] {
	if (!verify) return [NOT_RUN];
	return verify.steps.map(
		(step) => `- ${step.passed ? '✓' : '✕ FAILED'} ${step.name} (${step.durationMs} ms)`
	);
}

function unitSection(unit: VitestReport | undefined, rootDir: string): string[] {
	if (!unit) return [NOT_RUN];
	const lines = [
		`${unit.numPassedTests} passed · ${unit.numFailedTests} failed · ` +
			`${unit.numPendingTests} skipped · ${unit.numTotalTests} total`
	];
	for (const file of unit.testResults) {
		const path = relative(file.name, rootDir);
		const failed = file.assertionResults.filter((test) => test.status === 'failed');
		if (failed.length === 0 && file.status === 'failed') {
			lines.push(`- ✕ ${path}: ${excerpt(file.message)}`);
		}
		for (const test of failed) {
			const where = test.location ? `${path}:${test.location.line}` : path;
			lines.push(`- ✕ ${where} ${test.fullName}: ${excerpt(test.failureMessages[0])}`);
		}
	}
	return lines;
}

function percent(covered: number, total: number): number {
	return total === 0 ? 100 : (covered / total) * 100;
}

function thresholdRow(threshold: CoverageThreshold, coverage: CoverageSummary, rootDir: string) {
	const files = Object.entries(coverage).filter(
		([file]) => file !== 'total' && relative(file, rootDir).startsWith(threshold.dir)
	);
	if (files.length === 0) return `| ${threshold.dir} | no files yet | ${threshold.min}% | – |`;
	const sum = (metric: 'lines' | 'branches', field: 'covered' | 'total') =>
		files.reduce((total, [, record]) => total + record[metric][field], 0);
	const lines = percent(sum('lines', 'covered'), sum('lines', 'total'));
	const branches = percent(sum('branches', 'covered'), sum('branches', 'total'));
	const passed = lines >= threshold.min && branches >= threshold.min;
	const shown = `${lines.toFixed(1)}% lines, ${branches.toFixed(1)}% branches`;
	return `| ${threshold.dir} | ${shown} | ${threshold.min}% | ${passed ? '✓' : '✕ BELOW'} |`;
}

function coverageSection(
	coverage: CoverageSummary | undefined,
	thresholds: CoverageThreshold[],
	rootDir: string
): string[] {
	if (!coverage) return [NOT_RUN];
	const total = coverage.total;
	const header = total
		? [`Total: ${total.lines.pct}% lines, ${total.branches.pct}% branches`, '']
		: [];
	return [
		...header,
		'| Directory | Coverage | Minimum | Verdict |',
		'| --- | --- | --- | --- |',
		...thresholds.map((threshold) => thresholdRow(threshold, coverage, rootDir))
	];
}

function bundleSection(bundle: BundleReport | undefined): string[] {
	if (!bundle) return [NOT_RUN];
	return [
		`${bundle.passed ? '✓' : '✕ FAILED'} shell ${bundle.shellKb.toFixed(1)} KB gzipped ` +
			`(budget ${bundle.budgetKb} KB)`,
		...bundle.forbidden.map(({ file, library }) => `- ✕ ${library} in ${file}`)
	];
}

function simSection(sim: SimVerdict[]): string[] {
	if (sim.length === 0) return [NOT_RUN];
	return sim.map(
		(verdict) => `- ${verdict.passed ? '✓' : '✕ FAILED'} ${verdict.scenario} (seed ${verdict.seed})`
	);
}

function failedSpecs(suite: PlaywrightSuite, rootDir: string): string[] {
	const own = (suite.specs ?? [])
		.filter((spec) => !spec.ok)
		.map((spec) => {
			const message = spec.tests.flatMap((test) => test.results).find((r) => r.error)?.error;
			const where = `${relative(spec.file, rootDir)}:${spec.line}`;
			return `- ✕ ${where} ${spec.title}: ${excerpt(message?.message)}`;
		});
	return [...own, ...(suite.suites ?? []).flatMap((child) => failedSpecs(child, rootDir))];
}

function e2eSection(e2e: PlaywrightReport | undefined, rootDir: string): string[] {
	if (!e2e) return [NOT_RUN];
	const { expected, unexpected, flaky, skipped } = e2e.stats;
	return [
		`${expected} passed · ${unexpected} failed · ${flaky} flaky · ${skipped} skipped`,
		...e2e.suites.flatMap((suite) => failedSpecs(suite, rootDir))
	];
}

/**
 * Builds `test-results/summary.md`: one page with totals, failures with file:line, coverage vs
 * thresholds, bundle size and sim scenario verdicts. A report that is missing is shown as "not run".
 *
 * @see BUILD_PLAN §11.3
 */
export function buildSummary(input: SummaryInput): string {
	const { rootDir } = input;
	const sections: [string, string[]][] = [
		['Verify', verifySection(input.verify)],
		['Unit + sim', unitSection(input.unit, rootDir)],
		['Coverage', coverageSection(input.coverage, input.thresholds, rootDir)],
		['Bundle', bundleSection(input.bundle)],
		['Sim scenarios', simSection(input.sim)],
		['E2E', e2eSection(input.e2e, rootDir)]
	];
	const body = sections.map(([title, lines]) => `## ${title}\n\n${lines.join('\n')}`);
	return [`# Test summary`, `Generated ${input.generatedAt}`, ...body].join('\n\n') + '\n';
}
