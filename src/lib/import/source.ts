import type { ImportError } from './ast.ts';
import { splitLines } from './lexer.ts';

/** The paste with every line that isn't import text blanked, so line numbers stay true. */
export interface PreparedSource {
	text: string;
	/** What was ignored, as warnings (never errors). */
	warnings: ImportError[];
}

const FENCE = /^```/;
const OUTSIDE = "Text outside the chatbot's code block was ignored.";
const PREAMBLE = 'Text before the first @ line was ignored.';

/** Which lines to keep: inside fences when the paste has any, else all; ``` lines never. */
function fencedLines(lines: readonly string[]): { keep: boolean[]; outside: number[] } {
	const hasFences = lines.some((line) => FENCE.test(line.trim()));
	let inside = false;
	const outside: number[] = [];
	const keep = lines.map((raw, index) => {
		const text = raw.trim();
		if (FENCE.test(text)) {
			inside = !inside;
			return false;
		}
		if (!hasFences || inside) return true;
		if (text !== '') outside.push(index);
		return false;
	});
	return { keep, outside };
}

/** One warning per run of ignored lines, at its first line. */
function runWarnings(indexes: readonly number[], message: string): ImportError[] {
	return indexes
		.filter((index, i) => i === 0 || indexes[i - 1] !== index - 1)
		.map((index) => ({ line: index + 1, message }));
}

/**
 * Keeps only import text: drops ``` lines; when the paste has code fences, drops every line
 * outside them (a chatbot's words between replies); drops text before the first `@` line. Ignored
 * lines become empty lines, so the parser's line numbers match the paste.
 *
 * @see docs/PROMPTS.md §7 (robust parsing) and Decisions log (Import v2: robust parsing)
 */
export function prepareSource(source: string): PreparedSource {
	const lines = splitLines(source);
	const { keep, outside } = fencedLines(lines);
	const firstDirective = lines.findIndex((raw, i) => keep[i] && raw.trim().startsWith('@'));
	const preamble: number[] = [];
	const kept = lines.map((raw, index) => {
		if (!keep[index]) return '';
		if (firstDirective === -1 || index < firstDirective) {
			if (raw.trim() !== '') preamble.push(index);
			return '';
		}
		return raw;
	});
	const warnings = [...runWarnings(outside, OUTSIDE), ...runWarnings(preamble, PREAMBLE)].sort(
		(a, b) => a.line - b.line
	);
	return { text: kept.join('\n'), warnings };
}
