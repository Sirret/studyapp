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

/**
 * Builds `test-results/summary.md`: one page with totals, failures with file:line, coverage vs
 * thresholds, bundle size and sim scenario verdicts. A report that is missing is shown as "not run".
 *
 * @see BUILD_PLAN §11.3
 */
export function buildSummary(_input: SummaryInput): string {
	throw new Error('not implemented');
}
