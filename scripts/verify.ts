/**
 * Everything CI runs, locally. Stops at the first failing step but always writes
 * `test-results/summary.md`, so there is one place to look whatever failed.
 *
 * @see BUILD_PLAN §11.6
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import type { VerifyReport } from './lib/summary.ts';

const RESULTS_DIR = 'test-results';
const STEPS = [
	'check',
	'lint',
	'stub-check',
	'test',
	'build:test',
	'bundle-check',
	'test:e2e:built'
];

function runScript(name: string): boolean {
	console.log(`\n=== ${name} ===`);
	return spawnSync(`npm run ${name}`, { stdio: 'inherit', shell: true }).status === 0;
}

// Reports from an earlier run must not pass for this one.
rmSync(RESULTS_DIR, { recursive: true, force: true });
rmSync('coverage', { recursive: true, force: true });
mkdirSync(RESULTS_DIR, { recursive: true });

const report: VerifyReport = { steps: [] };
for (const name of STEPS) {
	const startedAt = Date.now();
	const passed = runScript(name);
	report.steps.push({ name, passed, durationMs: Date.now() - startedAt });
	if (!passed) break;
}
writeFileSync(`${RESULTS_DIR}/verify.json`, JSON.stringify(report, null, '\t'));

const reported = runScript('test:report');
const failed = report.steps.find((step) => !step.passed);
if (failed) console.error(`\nverify failed at "${failed.name}". Read ${RESULTS_DIR}/summary.md.`);
process.exitCode = failed || !reported ? 1 : 0;
