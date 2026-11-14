import type { ImportError } from './ast.ts';

/**
 * A prompt the student pastes into their chatbot to rewrite the parts the import skipped: it
 * quotes each skipped line with the reason, and asks for only those parts again in the import
 * format, ending in `@end`. `null` when nothing was skipped.
 *
 * @see BUILD_PLAN §10 row 8.5 ("a copy a fix-it prompt for skipped parts")
 * @see PROMPTS.md
 */
export function buildFixPrompt(_errors: readonly ImportError[], _source: string): string | null {
	throw new Error('not implemented');
}
