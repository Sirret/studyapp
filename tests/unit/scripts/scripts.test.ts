import { describe, expect, it } from 'vitest';
import { SHELL_JS_BUDGET_KB } from '../../../src/lib/config/defaults.ts';
import {
	collectShellFiles,
	evaluateBundle,
	findShellRoots,
	type ViteManifest
} from '../../../scripts/lib/bundle.ts';
import { findStubs } from '../../../scripts/lib/stubs.ts';
import { buildSummary, type SummaryInput } from '../../../scripts/lib/summary.ts';

describe('collectShellFiles', () => {
	const manifest: ViteManifest = {
		app: { file: 'app.js', imports: ['shared'], dynamicImports: ['lazy'] },
		page: { file: 'page.js', imports: ['shared'] },
		shared: { file: 'shared.js' },
		lazy: { file: 'lazy.js', imports: ['heavy'] },
		heavy: { file: 'heavy.js' }
	};

	it('follows static imports, without duplicates, and leaves out dynamic ones', () => {
		expect(collectShellFiles(manifest, ['page', 'app'])).toEqual([
			'app.js',
			'page.js',
			'shared.js'
		]);
	});
});

describe('evaluateBundle', () => {
	it('passes a small shell', () => {
		const report = evaluateBundle([{ file: 'a.js', content: 'a' }], SHELL_JS_BUDGET_KB);
		expect(report.passed).toBe(true);
		expect(report.chunks[0]?.file).toBe('a.js');
	});

	it('fails a shell over budget, measured gzipped', () => {
		const repetitive = 'x'.repeat(100_000);
		expect(evaluateBundle([{ file: 'a.js', content: repetitive }], 1).passed).toBe(true);

		const incompressible = Array.from({ length: 40_000 }, (_, i) => (i * i * 31).toString(36));
		const report = evaluateBundle([{ file: 'a.js', content: incompressible.join('') }], 1);
		expect(report.shellKb).toBeGreaterThan(1);
		expect(report.passed).toBe(false);
	});

	it.each([
		['tesseract.js', 'createWorker from "tesseract.js"'],
		['elkjs', 'new ELK("elk.bundled.js")'],
		['Svelte Flow', 'import "@xyflow/svelte"']
	])('fails a shell containing %s', (library, content) => {
		const report = evaluateBundle([{ file: 'a.js', content }], SHELL_JS_BUDGET_KB);
		expect(report.passed).toBe(false);
		expect(report.forbidden).toEqual([{ file: 'a.js', library }]);
	});
});

describe('findStubs', () => {
	it('reports each stub with its 1-based line', () => {
		const files = [
			{ path: 'clean.ts', content: 'export const a = 1;\n' },
			{ path: 'stub.ts', content: "line one\nthrow new Error('not implemented');\n" }
		];
		expect(findStubs(files)).toEqual([{ path: 'stub.ts', line: 2 }]);
	});
});

describe('buildSummary', () => {
	const rootDir = 'C:/repo';
	const base: SummaryInput = {
		generatedAt: 'NOW',
		rootDir,
		thresholds: [{ dir: 'src/lib/engine/', min: 90 }],
		sim: []
	};
	const metric = (covered: number, total: number) => ({
		covered,
		total,
		pct: (covered / total) * 100
	});

	it('shows every missing report as not run', () => {
		const summary = buildSummary(base);
		expect(summary.match(/not run/g)).toHaveLength(6);
	});

	it('is deterministic', () => {
		expect(buildSummary(base)).toBe(buildSummary(base));
	});

	it('lists failing unit tests with file:line and strips the root', () => {
		const summary = buildSummary({
			...base,
			unit: {
				numTotalTests: 2,
				numPassedTests: 1,
				numFailedTests: 1,
				numPendingTests: 0,
				testResults: [
					{
						name: `${rootDir}/tests/a.test.ts`,
						status: 'failed',
						assertionResults: [
							{ fullName: 'ok', status: 'passed', failureMessages: [] },
							{
								fullName: 'broken',
								status: 'failed',
								failureMessages: ['expected 1'],
								location: { line: 12, column: 3 }
							}
						]
					}
				]
			}
		});
		expect(summary).toContain('1 passed · 1 failed');
		expect(summary).toContain('tests/a.test.ts:12 broken: expected 1');
		expect(summary).not.toContain(rootDir);
	});

	it('lists a test file that failed before any test ran', () => {
		const summary = buildSummary({
			...base,
			unit: {
				numTotalTests: 0,
				numPassedTests: 0,
				numFailedTests: 0,
				numPendingTests: 0,
				testResults: [
					{
						name: `${rootDir}/tests/b.test.ts`,
						status: 'failed',
						message: 'Cannot find module',
						assertionResults: []
					}
				]
			}
		});
		expect(summary).toContain('tests/b.test.ts: Cannot find module');
	});

	it('marks a directory below its coverage minimum, using the sum of its files', () => {
		const file = (covered: number) => ({
			lines: metric(covered, 100),
			branches: metric(covered, 100)
		});
		const summary = buildSummary({
			...base,
			coverage: {
				total: file(50),
				[`${rootDir}/src/lib/engine/a.ts`]: file(100),
				[`${rootDir}/src/lib/engine/b.ts`]: file(50),
				[`${rootDir}/src/lib/other/c.ts`]: file(0)
			}
		});
		expect(summary).toContain('75.0% lines');
		expect(summary).toContain('✕ BELOW');
	});

	it('passes a directory at its minimum and notes a directory with no files', () => {
		const file = { lines: metric(90, 100), branches: metric(90, 100) };
		const summary = buildSummary({
			...base,
			thresholds: [...base.thresholds, { dir: 'src/lib/import/', min: 80 }],
			coverage: { [`${rootDir}/src/lib/engine/a.ts`]: file }
		});
		expect(summary).not.toContain('BELOW');
		expect(summary).toContain('| src/lib/import/ | no files yet');
	});

	it('shows the bundle verdict and any heavy library', () => {
		const summary = buildSummary({
			...base,
			bundle: {
				budgetKb: 150,
				shellKb: 200,
				chunks: [],
				forbidden: [{ file: 'a.js', library: 'elkjs' }],
				passed: false
			}
		});
		expect(summary).toContain('shell 200.0 KB gzipped (budget 150 KB)');
		expect(summary).toContain('elkjs in a.js');
	});

	it('shows sim verdicts and verify steps', () => {
		const summary = buildSummary({
			...base,
			sim: [{ scenario: 'one-night', passed: false, seed: 7 }],
			verify: { steps: [{ name: 'lint', passed: true, durationMs: 5 }] }
		});
		expect(summary).toContain('✕ FAILED one-night (seed 7)');
		expect(summary).toContain('✓ lint');
	});

	it('lists failing e2e specs from nested suites with file:line', () => {
		const summary = buildSummary({
			...base,
			e2e: {
				stats: { expected: 1, unexpected: 1, flaky: 0, skipped: 0 },
				suites: [
					{
						suites: [
							{
								specs: [
									{
										title: 'opens offline',
										ok: false,
										file: 'pwa.spec.ts',
										line: 9,
										tests: [{ results: [{ error: { message: 'timed out' } }] }]
									}
								]
							}
						]
					}
				]
			}
		});
		expect(summary).toContain('1 passed · 1 failed');
		expect(summary).toContain('pwa.spec.ts:9 opens offline: timed out');
	});
});

describe('findShellRoots', () => {
	const prefix = '.svelte-kit/generated/build/client-optimized';
	const kit = 'node_modules/@sveltejs/kit/src/runtime/client';
	const entry = { file: 'x.js' };
	const complete: ViteManifest = {
		[`${prefix}/app.js`]: entry,
		[`${kit}/entry.js`]: entry,
		[`${kit}/client-entry.js`]: entry,
		[`${prefix}/nodes/0.js`]: entry,
		[`${prefix}/nodes/1.js`]: entry,
		[`${prefix}/nodes/2.js`]: entry,
		[`${prefix}/nodes/3.js`]: entry
	};
	const readNode = (key: string) =>
		key.endsWith('nodes/3.js') ? 'export * from "src/routes/+page.svelte"' : 'other';

	it('finds the entries, layout, error page and whichever node is the home page', () => {
		const { roots, missing } = findShellRoots(complete, readNode);
		expect(missing).toEqual([]);
		expect(roots).toContain(`${prefix}/nodes/3.js`);
		expect(roots).not.toContain(`${prefix}/nodes/2.js`);
		expect(roots).toHaveLength(6);
	});

	it('reports what is missing when the build layout changes', () => {
		expect(findShellRoots({}, readNode).missing).toHaveLength(6);
	});
});
