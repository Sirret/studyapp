import type { ImportDocument, ImportError } from './ast.ts';

/** The valid blocks of an import text, plus an error for each line that isn't valid. */
export interface ParseOutput {
	document: ImportDocument;
	errors: ImportError[];
}

/**
 * Parses import text. Never throws: a bad line becomes an error and the rest still parses.
 *
 * @see BUILD_PLAN §4.1
 */
export function parseImport(_text: string): ParseOutput {
	throw new Error('not implemented');
}
