/**
 * Merges the latest reports into `test-results/summary.md`, the first file to read after any failed
 * run.
 *
 * @see BUILD_PLAN §11.3
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { COVERAGE_DATA_MIN, COVERAGE_ENGINE_MIN } from '../src/lib/config/defaults.ts';
import { buildSummary, type SimVerdict } from './lib/summary.ts';

const RESULTS_DIR = 'test-results';
const SIM_DIR = path.join(RESULTS_DIR, 'sim');

function readReport<T>(file: string): T | undefined {
	return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : undefined;
}

function readSimVerdicts(): SimVerdict[] {
	if (!existsSync(SIM_DIR)) return [];
	return readdirSync(SIM_DIR)
		.filter((file) => file.endsWith('.json'))
		.sort()
		.map((file) => JSON.parse(readFileSync(path.join(SIM_DIR, file), 'utf8')) as SimVerdict);
}

const summary = buildSummary({
	generatedAt: new Date().toISOString(),
	rootDir: process.cwd().replaceAll('\\', '/'),
	verify: readReport(path.join(RESULTS_DIR, 'verify.json')),
	unit: readReport(path.join(RESULTS_DIR, 'unit.json')),
	coverage: readReport('coverage/coverage-summary.json'),
	thresholds: [
		{ dir: 'src/lib/engine/', min: COVERAGE_ENGINE_MIN },
		{ dir: 'src/lib/import/', min: COVERAGE_DATA_MIN },
		{ dir: 'src/lib/transfer/', min: COVERAGE_DATA_MIN },
		{ dir: 'src/lib/db/', min: COVERAGE_DATA_MIN }
	],
	bundle: readReport(path.join(RESULTS_DIR, 'bundle.json')),
	sim: readSimVerdicts(),
	e2e: readReport(path.join(RESULTS_DIR, 'e2e.json'))
});

mkdirSync(RESULTS_DIR, { recursive: true });
writeFileSync(path.join(RESULTS_DIR, 'summary.md'), summary);
console.log(`Wrote ${RESULTS_DIR}/summary.md`);
