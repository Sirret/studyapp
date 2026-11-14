import type { ImportError } from './ast.ts';
import { finishBlock, isBlockChecked, type BlockOutput, type RawBlock } from './block-parsers.ts';

/** A Markdown header separator, such as `|---|:--:|`. */
const SEPARATOR_ROW = /^\|[\s:|-]*-[\s:|-]*$/;

/** Splits `| a | b |` into cells; the closing pipe is optional. */
function readCells(text: string): string[] {
	const cells = text.slice(1).split('|');
	if (cells.at(-1)?.trim() === '') cells.pop();
	return cells.map((cell) => cell.trim());
}

function rowProblem(text: string, expectedCells: number | undefined): string | undefined {
	if (!text.startsWith('|')) return 'Expected a table row starting with |.';
	const cells = readCells(text);
	if (expectedCells === undefined) {
		return cells.slice(1).includes('') ? 'A table cell is empty.' : undefined;
	}
	if (cells.length !== expectedCells) {
		return `Expected ${expectedCells} cells, found ${cells.length}.`;
	}
	return cells.includes('') ? 'A table cell is empty.' : undefined;
}

/** The table rows of a `@compare` or `@cheat` block, or the errors that skip it. */
export function readTable(
	raw: RawBlock
):
	{ items: string[]; rows: { attribute: string; values: string[] }[] } | { errors: ImportError[] } {
	const rows = raw.lines.filter((line) => !SEPARATOR_ROW.test(line.text));
	const errors: ImportError[] = [];
	let expectedCells: number | undefined;
	for (const { line, text } of rows) {
		const problem = rowProblem(text, expectedCells);
		if (problem) errors.push({ line, message: `${problem} The @${raw.name} block was skipped.` });
		else expectedCells ??= readCells(text).length;
	}
	if (errors.length > 0) return { errors };
	const [header, ...body] = rows.map((row) => readCells(row.text));
	return {
		items: header?.slice(1) ?? [],
		rows: body.map(([attribute = '', ...values]) => ({ attribute, values }))
	};
}

/**
 * Parses `@compare [name]`: the first row names the items, and a bad row skips the whole table, since a
 * table missing a row would teach the wrong comparison.
 *
 * @see BUILD_PLAN §4.1
 */
export function parseCompare(raw: RawBlock): BlockOutput {
	const table = readTable(raw);
	if ('errors' in table) return table;
	return finishBlock(raw, {
		kind: 'compare',
		line: raw.line,
		isChecked: isBlockChecked(raw),
		...(raw.argument ? { name: raw.argument } : {}),
		...table
	});
}
