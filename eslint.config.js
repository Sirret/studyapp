import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

/** Size and complexity limits from BUILD_PLAN §15.5. */
const sizeRules = (severity) => ({
	'max-lines': [severity, { max: 300, skipBlankLines: true, skipComments: true }],
	'max-lines-per-function': [severity, { max: 50, skipBlankLines: true, skipComments: true }],
	complexity: [severity, 10]
});

/**
 * Matches an import of the given path under `src/lib`, by alias or by relative path. A regex because
 * the default gitignore-style patterns read a leading `#` as a comment.
 */
const libImport = (paths) => `^(#lib/|.*/)(${paths.join('|')})(/|\\.|$)`;

/** Bans importing the named lib paths and packages. */
const bannedImports = (message, paths, packages = []) => ({
	'no-restricted-imports': [
		'error',
		{
			patterns: [
				{ regex: libImport(paths), message },
				...packages.map((name) => ({ regex: `^${name}(/|$)`, message }))
			]
		}
	]
});

const uiBoundary = bannedImports(
	'UI imports services, never Dexie or repos (BUILD_PLAN §15.1).',
	['db/schema', 'db/repos'],
	['dexie']
);

/** @see BUILD_PLAN §15.1 (import direction) and CLAUDE.md rule 2 (pure engine) */
const engineRules = {
	...sizeRules('error'),
	...bannedImports(
		'The engine is pure: it imports only config, schemas and engine modules.',
		['db/schema', 'db/repos', 'services', 'ui', 'exercises', 'log', 'pwa'],
		['dexie', 'svelte', '\\$app']
	),
	'no-console': 'error',
	'no-restricted-globals': [
		'error',
		...[
			'window',
			'document',
			'navigator',
			'localStorage',
			'sessionStorage',
			'indexedDB',
			'fetch',
			'XMLHttpRequest',
			'WebSocket',
			'crypto'
		].map((name) => ({ name, message: 'The engine is pure: no DOM, IO or network.' }))
	],
	'no-restricted-properties': [
		'error',
		{ object: 'Date', property: 'now', message: 'The engine takes time as an argument.' },
		{ object: 'Math', property: 'random', message: 'Use the seeded engine/rng.ts.' }
	],
	'no-restricted-syntax': [
		'error',
		{
			selector: "NewExpression[callee.name='Date'][arguments.length=0]",
			message: 'The engine takes time as an argument.'
		}
	]
};

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			'no-undef': 'off',
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			...sizeRules('warn')
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: { parserOptions: { parser: ts.parser } }
	},
	{ files: ['src/lib/engine/**/*.ts'], rules: engineRules },
	{
		files: ['src/routes/**', 'src/lib/ui/**', 'src/lib/exercises/**'],
		rules: uiBoundary
	},
	{
		files: ['src/lib/db/**'],
		rules: bannedImports('The data layer never imports services or UI (BUILD_PLAN §15.1).', [
			'services',
			'ui',
			'exercises'
		])
	},
	{
		files: ['tests/**', 'scripts/**', '*.config.ts', '*.config.js'],
		rules: { 'max-lines': 'off', 'max-lines-per-function': 'off', complexity: 'off' }
	},
	{
		ignores: [
			'node_modules/',
			'.svelte-kit/',
			'build/',
			'coverage/',
			'test-results/',
			'playwright-report/'
		]
	}
);
