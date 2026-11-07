import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * The architecture rules only hold while the lint config enforces them, so this checks the config
 * itself against real code samples.
 *
 * @see BUILD_PLAN §15.1 and §15.5
 * @see CLAUDE.md rule 2
 */
describe('lint boundaries', () => {
	let eslint: ESLint;

	// The first lint loads every plugin, which is slow on a cold start.
	beforeAll(async () => {
		eslint = new ESLint();
		await eslint.lintText('export {};\n', { filePath: 'src/lib/engine/sample.ts' });
	}, 120_000);

	async function ruleIdsFor(code: string, filePath: string): Promise<(string | null)[]> {
		const results = await eslint.lintText(code, { filePath });
		return results.flatMap((result) => result.messages.map((message) => message.ruleId));
	}

	describe('the engine stays pure', () => {
		const filePath = 'src/lib/engine/sample.ts';

		it.each([
			["import Dexie from 'dexie';\nexport const x = Dexie;\n"],
			["import { LogRepo } from '#lib/db/repos/log-repo.ts';\nexport const x = LogRepo;\n"],
			["import { createDb } from '../db/schema.ts';\nexport const x = createDb;\n"],
			["import { logger } from '#lib/services/app.ts';\nexport const x = logger;\n"],
			["import { Logger } from '../log/logger.ts';\nexport const x = Logger;\n"],
			["import { mount } from 'svelte';\nexport const x = mount;\n"],
			["import { dev } from '$app/env';\nexport const x = dev;\n"]
		])('rejects a forbidden import: %s', async (code) => {
			expect(await ruleIdsFor(code, filePath)).toContain('no-restricted-imports');
		});

		it('allows config and schema imports', async () => {
			const code =
				"import { RETENTION } from '#lib/config/defaults.ts';\n" +
				"import { LogLevelSchema } from '#lib/db/schemas/log-entry.ts';\n" +
				'export const x = [RETENTION, LogLevelSchema];\n';
			expect(await ruleIdsFor(code, filePath)).toEqual([]);
		});

		it('rejects Date.now and Math.random', async () => {
			expect(await ruleIdsFor('export const x = Date.now();\n', filePath)).toContain(
				'no-restricted-properties'
			);
			expect(await ruleIdsFor('export const x = Math.random();\n', filePath)).toContain(
				'no-restricted-properties'
			);
		});

		it('rejects new Date() without an argument but allows one with a time', async () => {
			expect(await ruleIdsFor('export const x = new Date();\n', filePath)).toContain(
				'no-restricted-syntax'
			);
			expect(await ruleIdsFor('export const x = (t: number) => new Date(t);\n', filePath)).toEqual(
				[]
			);
		});

		it('rejects console, DOM and network globals', async () => {
			expect(await ruleIdsFor("console.log('x');\n", filePath)).toContain('no-console');
			expect(await ruleIdsFor('export const x = document.title;\n', filePath)).toContain(
				'no-restricted-globals'
			);
			expect(await ruleIdsFor("export const x = fetch('/');\n", filePath)).toContain(
				'no-restricted-globals'
			);
		});

		it('makes the size limits errors', async () => {
			const longFunction = `export function f() {\n${'\tvoid 0;\n'.repeat(51)}}\n`;
			const results = await eslint.lintText(longFunction, { filePath });
			const message = results[0]?.messages.find((m) => m.ruleId === 'max-lines-per-function');
			expect(message?.severity).toBe(2);
		});
	});

	describe('the UI goes through services', () => {
		it.each([
			["import Dexie from 'dexie';\nexport const x = Dexie;\n"],
			["import { createDb } from '#lib/db/schema.ts';\nexport const x = createDb;\n"],
			["import { LogRepo } from '#lib/db/repos/log-repo.ts';\nexport const x = LogRepo;\n"]
		])('rejects a forbidden import in a route: %s', async (code) => {
			expect(await ruleIdsFor(code, 'src/routes/sample.ts')).toContain('no-restricted-imports');
		});

		it('allows importing a service', async () => {
			const code = "import { logger } from '#lib/services/app.ts';\nexport const x = logger;\n";
			expect(await ruleIdsFor(code, 'src/routes/sample.ts')).toEqual([]);
		});
	});

	it.each(['src/routes/sample.ts', 'src/hooks.client.ts', 'src/lib/ui/sample.ts'])(
		'rejects an engine import in UI code: %s',
		async (filePath) => {
			const code = "import { x } from '#lib/engine/sample.ts';\nexport const y = x;\n";
			expect(await ruleIdsFor(code, filePath)).toContain('no-restricted-imports');
		}
	);

	it.each(['src/lib/services/sample.ts', 'src/lib/log/sample.ts', 'src/lib/pwa/sample.ts'])(
		'rejects a UI import in %s',
		async (filePath) => {
			const code = "import { x } from '#lib/ui/sample.ts';\nexport const y = x;\n";
			expect(await ruleIdsFor(code, filePath)).toContain('no-restricted-imports');
		}
	);

	it('allows a service to import the engine and a repo', async () => {
		const code =
			"import { x } from '#lib/engine/sample.ts';\n" +
			"import { LogRepo } from '#lib/db/repos/log-repo.ts';\n" +
			'export const y = [x, LogRepo];\n';
		expect(await ruleIdsFor(code, 'src/lib/services/sample.ts')).toEqual([]);
	});

	describe('the import pipeline stays free of IO', () => {
		it.each([
			["import Dexie from 'dexie';\nexport const x = Dexie;\n"],
			["import { CardRepo } from '#lib/db/repos/content-repos.ts';\nexport const x = CardRepo;\n"],
			["import { logger } from '#lib/services/app.ts';\nexport const x = logger;\n"]
		])('rejects a forbidden import: %s', async (code) => {
			expect(await ruleIdsFor(code, 'src/lib/import/sample.ts')).toContain('no-restricted-imports');
		});

		it('allows the engine and schemas', async () => {
			const code =
				"import { x } from '#lib/engine/sample.ts';\n" +
				"import { y } from '#lib/db/schemas/note.ts';\n" +
				'export const z = [x, y];\n';
			expect(await ruleIdsFor(code, 'src/lib/import/sample.ts')).toEqual([]);
		});

		it('is reached through a service, not from the UI', async () => {
			const code = "import { x } from '#lib/import/parser.ts';\nexport const y = x;\n";
			expect(await ruleIdsFor(code, 'src/routes/sample.ts')).toContain('no-restricted-imports');
		});
	});

	describe('the data layer never imports upward', () => {
		it.each(['services/app.ts', 'engine/sample.ts', 'log/logger.ts', 'pwa/register-sw.ts'])(
			'rejects importing %s in a repo',
			async (target) => {
				const code = `import { x } from '#lib/${target}';\nexport const y = x;\n`;
				expect(await ruleIdsFor(code, 'src/lib/db/repos/sample.ts')).toContain(
					'no-restricted-imports'
				);
			}
		);

		it('allows a repo to import schemas', async () => {
			const code = "import { z } from '../schemas/log-entry.ts';\nexport const y = z;\n";
			expect(await ruleIdsFor(code, 'src/lib/db/repos/sample.ts')).toEqual([]);
		});

		it('allows Dexie in the data layer', async () => {
			const code = "import Dexie from 'dexie';\nexport const x = Dexie;\n";
			expect(await ruleIdsFor(code, 'src/lib/db/sample.ts')).toEqual([]);
		});
	});

	it('bans any everywhere', async () => {
		expect(await ruleIdsFor('export const x = 1 as any;\n', 'src/lib/log/sample.ts')).toContain(
			'@typescript-eslint/no-explicit-any'
		);
	});
});
