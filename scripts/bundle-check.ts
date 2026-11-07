/**
 * Fails if the app shell exceeds SHELL_JS_BUDGET_KB or contains a heavy library, and writes
 * `test-results/bundle.json`. Run after `npm run build`.
 *
 * @see BUILD_PLAN §11.1 (Performance) and §11.3
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { SHELL_JS_BUDGET_KB } from '../src/lib/config/defaults.ts';
import {
	collectShellFiles,
	evaluateBundle,
	type BundleReport,
	type ViteManifest
} from './lib/bundle.ts';

const CLIENT_DIR = '.svelte-kit/output/client';
const HOME_PAGE_MARKER = 'src/routes/+page.svelte';

/** The chunks every first visit loads: Kit's entries, the root layout, error page and home page. */
function findShellRoots(manifest: ViteManifest): string[] {
	return Object.keys(manifest).filter((key) => {
		if (/client-optimized\/app\.js$|runtime\/client\/(client-)?entry\.js$/.test(key)) return true;
		if (/client-optimized\/nodes\/[01]\.js$/.test(key)) return true;
		return (
			/client-optimized\/nodes\/\d+\.js$/.test(key) &&
			readFileSync(key, 'utf8').includes(HOME_PAGE_MARKER)
		);
	});
}

function printReport(report: BundleReport): void {
	console.log(`Shell: ${report.shellKb.toFixed(1)} KB gzipped (budget ${report.budgetKb} KB)`);
	for (const { file, library } of report.forbidden) {
		console.error(`Heavy library in the shell: ${library} in ${file}`);
	}
	if (report.shellKb > report.budgetKb) console.error('Shell is over budget.');
}

const manifest = JSON.parse(
	readFileSync(path.join(CLIENT_DIR, '.vite/manifest.json'), 'utf8')
) as ViteManifest;
const roots = findShellRoots(manifest);
const chunks = collectShellFiles(manifest, roots)
	.filter((file) => file.endsWith('.js'))
	.map((file) => ({ file, content: readFileSync(path.join(CLIENT_DIR, file), 'utf8') }));
const report = evaluateBundle(chunks, SHELL_JS_BUDGET_KB);

mkdirSync('test-results', { recursive: true });
writeFileSync('test-results/bundle.json', JSON.stringify(report, null, '\t'));
printReport(report);
process.exitCode = report.passed ? 0 : 1;
