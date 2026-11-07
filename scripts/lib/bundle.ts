import { gzipSync } from 'node:zlib';

/** One entry of Vite's `.vite/manifest.json`. */
export interface ViteManifestEntry {
	file: string;
	src?: string;
	isEntry?: boolean;
	imports?: string[];
	dynamicImports?: string[];
}

/** Vite's build manifest, keyed by source id. */
export type ViteManifest = Record<string, ViteManifestEntry>;

/** A built JavaScript file. */
export interface BuiltChunk {
	file: string;
	content: string;
}

/** The result of checking the shell, written to `test-results/bundle.json`. */
export interface BundleReport {
	budgetKb: number;
	/** Sum of the gzipped sizes of the shell's chunks. */
	shellKb: number;
	chunks: { file: string; gzipKb: number }[];
	/** Heavy libraries found in the shell. */
	forbidden: { file: string; library: string }[];
	passed: boolean;
}

const BYTES_PER_KB = 1024;

/** Text that only appears in a chunk if the library was bundled into it. */
const HEAVY_LIBRARIES = [
	{ library: 'tesseract.js', markers: ['tesseract'] },
	{ library: 'elkjs', markers: ['elkjs', 'elk.bundled', 'org.eclipse.elk'] },
	{ library: 'Svelte Flow', markers: ['@xyflow', 'svelte-flow'] }
];

/**
 * Returns the output files of the given manifest keys and of everything they import statically.
 * Dynamic imports are lazy, so they are not part of the shell. Sorted; no duplicates.
 *
 * @see BUILD_PLAN §11.1 (Performance)
 */
export function collectShellFiles(manifest: ViteManifest, rootKeys: string[]): string[] {
	const visited = new Set<string>();
	const pending = [...rootKeys];
	while (pending.length > 0) {
		const key = pending.pop();
		if (key === undefined || visited.has(key)) continue;
		visited.add(key);
		pending.push(...(manifest[key]?.imports ?? []));
	}
	const files = [...visited].flatMap((key) => manifest[key]?.file ?? []);
	return [...new Set(files)].sort();
}

/**
 * Measures the shell's chunks against the budget and looks for tesseract.js, elkjs and Svelte Flow.
 * Passes only if the total is within budget and no heavy library is present.
 *
 * @see BUILD_PLAN §11.1 (Performance), §0.7
 */
export function evaluateBundle(chunks: BuiltChunk[], budgetKb: number): BundleReport {
	const sized = chunks.map(({ file, content }) => ({
		file,
		gzipKb: gzipSync(content).length / BYTES_PER_KB
	}));
	const shellKb = sized.reduce((total, chunk) => total + chunk.gzipKb, 0);
	const forbidden = chunks.flatMap(({ file, content }) =>
		HEAVY_LIBRARIES.filter(({ markers }) => markers.some((m) => content.includes(m))).map(
			({ library }) => ({ file, library })
		)
	);
	return {
		budgetKb,
		shellKb,
		chunks: sized,
		forbidden,
		passed: shellKb <= budgetKb && forbidden.length === 0
	};
}

const SHELL_ROOT_PATTERNS = [
	{ name: 'app entry', pattern: /client-optimized\/app\.js$/ },
	{ name: 'start entry', pattern: /runtime\/client\/entry\.js$/ },
	{ name: 'client entry', pattern: /runtime\/client\/client-entry\.js$/ },
	{ name: 'root layout', pattern: /client-optimized\/nodes\/0\.js$/ },
	{ name: 'root error page', pattern: /client-optimized\/nodes\/1\.js$/ }
];
const ROUTE_NODE = /client-optimized\/nodes\/\d+\.js$/;
const HOME_PAGE_MARKER = 'src/routes/+page.svelte';

/**
 * Finds the chunks every first visit loads: Kit's entries, the root layout, error page and home
 * page. `missing` names any it could not find, so a change in Kit's build layout fails the check
 * instead of measuring an empty shell. `readNode` returns the source of a manifest key.
 *
 * @see BUILD_PLAN §11.1 (Performance)
 */
export function findShellRoots(
	manifest: ViteManifest,
	readNode: (key: string) => string
): { roots: string[]; missing: string[] } {
	const keys = Object.keys(manifest);
	const found = SHELL_ROOT_PATTERNS.map(({ name, pattern }) => ({
		name,
		key: keys.find((key) => pattern.test(key))
	}));
	const home = keys.find((key) => ROUTE_NODE.test(key) && readNode(key).includes(HOME_PAGE_MARKER));
	found.push({ name: 'home page', key: home });
	return {
		roots: found.flatMap(({ key }) => key ?? []),
		missing: found.filter(({ key }) => key === undefined).map(({ name }) => name)
	};
}
