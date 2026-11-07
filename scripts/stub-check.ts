/**
 * Fails if any interface-step stub remains anywhere in `src/`.
 *
 * @see BUILD_PLAN §2 and CLAUDE.md rule 1
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { findStubs } from './lib/stubs.ts';

const files = readdirSync('src', { recursive: true, withFileTypes: true })
	.filter((entry) => entry.isFile())
	.map((entry) => path.join(entry.parentPath, entry.name))
	.map((file) => ({ path: file, content: readFileSync(file, 'utf8') }));

const hits = findStubs(files);
for (const { path: file, line } of hits) console.error(`Stub left in ${file}:${line}`);
console.log(`stub-check: ${files.length} files scanned, ${hits.length} stubs`);
process.exitCode = hits.length === 0 ? 0 : 1;
