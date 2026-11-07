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

/**
 * Returns the output files of the given manifest keys and of everything they import statically.
 * Dynamic imports are lazy, so they are not part of the shell. Sorted; no duplicates.
 *
 * @see BUILD_PLAN §11.1 (Performance)
 */
export function collectShellFiles(_manifest: ViteManifest, _rootKeys: string[]): string[] {
	throw new Error('not implemented');
}

/**
 * Measures the shell's chunks against the budget and looks for tesseract.js, elkjs and Svelte Flow.
 * Passes only if the total is within budget and no heavy library is present.
 *
 * @see BUILD_PLAN §11.1 (Performance), §0.7
 */
export function evaluateBundle(_chunks: BuiltChunk[], _budgetKb: number): BundleReport {
	throw new Error('not implemented');
}
