/**
 * Shows where unfinished work stands, for resuming after a usage limit or in a new session:
 * the `docs/WIP.md` checkpoint (if any), changed files, interface stubs left in `src/`, and type
 * errors per file. Read-only; it never changes anything.
 *
 * Usage: `npm run wip` (add `-- --no-types` to skip the slower type check).
 *
 * @see CLAUDE.md (Starting a session) and docs/WIP.md
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { findStubs } from './lib/stubs.ts';

const WIP_FILE = path.join('docs', 'WIP.md');

function run(command: string): string {
	try {
		return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
	} catch (error) {
		// tsc exits non-zero when it finds errors; its output is still what we want.
		return (error as { stdout?: string }).stdout ?? '';
	}
}

function section(title: string, body: string): void {
	console.log(`\n=== ${title} ===\n${body.trim() || '(none)'}`);
}

function stubs(): string {
	const files = readdirSync('src', { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => path.join(entry.parentPath, entry.name))
		.map((file) => ({ path: file, content: readFileSync(file, 'utf8') }));
	return findStubs(files)
		.map(({ path: file, line }) => `${file}:${line}`)
		.join('\n');
}

function typeErrorsPerFile(): string {
	const counts = new Map<string, number>();
	for (const line of run('npx tsc --noEmit -p .').split('\n')) {
		const file = /^([^(]+)\(\d+,\d+\): error/.exec(line)?.[1];
		if (file) counts.set(file, (counts.get(file) ?? 0) + 1);
	}
	return [...counts].map(([file, n]) => `${n}\t${file}`).join('\n');
}

section(
	'Checkpoint (docs/WIP.md)',
	existsSync(WIP_FILE) ? readFileSync(WIP_FILE, 'utf8') : 'No work in progress.'
);
section('Changed files (git status)', run('git status --short'));
section('Interface stubs left in src/', stubs());
if (!process.argv.includes('--no-types')) section('Type errors per file', typeErrorsPerFile());
console.log('\nNext: npx vitest run <files> for the step in progress, then npm run verify.');
