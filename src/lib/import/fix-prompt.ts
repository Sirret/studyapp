import type { ImportError } from './ast.ts';

function quoteLine(error: ImportError, lines: readonly string[]): string {
	const text = lines[error.line - 1];
	const quoted = text === undefined || text.trim() === '' ? '' : `\n   > ${text.trim()}`;
	return `- Line ${error.line}: ${error.message}${quoted}`;
}

/**
 * A prompt the student pastes into their chatbot to rewrite the parts the import skipped: it
 * quotes each skipped line with the reason, and asks for only those parts again in the import
 * format, ending in `@end`. `null` when nothing was skipped.
 *
 * @see BUILD_PLAN §10 row 8.5 ("a copy a fix-it prompt for skipped parts")
 * @see PROMPTS.md
 */
export function buildFixPrompt(errors: readonly ImportError[], source: string): string | null {
	if (errors.length === 0) return null;
	const lines = source.split(/\r?\n/);
	const parts = [...errors].sort((a, b) => a.line - b.line).map((e) => quoteLine(e, lines));
	return [
		'My study app could not import these parts of your last reply:',
		'',
		...parts,
		'',
		'Rewrite only these parts, fixed, in the same import format you used before.',
		'Keep the same @deck and @topic headings they were under. Do not repeat anything else.',
		'End your reply with @end on its own line.'
	].join('\n');
}
