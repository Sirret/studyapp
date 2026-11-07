/** A source file to scan. */
export interface SourceFile {
	path: string;
	content: string;
}

/** Where a leftover stub was found (`line` is 1-based). */
export interface StubHit {
	path: string;
	line: number;
}

/**
 * Finds every line containing the interface-step stub marker, in the order given.
 *
 * @see BUILD_PLAN §2 (stub-check)
 * @see CLAUDE.md rule 1
 */
export function findStubs(_files: SourceFile[]): StubHit[] {
	throw new Error('not implemented');
}
