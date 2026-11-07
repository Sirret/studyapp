import type { ImportDocument, ImportError } from './ast.ts';
import { BLOCK_PARSERS, type RawBlock } from './block-parsers.ts';
import { lex } from './lexer.ts';

/** The valid blocks of an import text, plus an error for each line that isn't valid. */
export interface ParseOutput {
	document: ImportDocument;
	errors: ImportError[];
}

/** Gathers each directive with the text lines under it. */
function groupBlocks(source: string): { raws: RawBlock[]; errors: ImportError[] } {
	const raws: RawBlock[] = [];
	const errors: ImportError[] = [];
	for (const token of lex(source)) {
		if (token.kind === 'directive') {
			raws.push({ ...token, lines: [] });
			continue;
		}
		const current = raws.at(-1);
		if (current) current.lines.push(token);
		else errors.push({ line: token.line, message: 'This line is not under any @ directive.' });
	}
	return { raws, errors };
}

/**
 * Parses import text. Never throws: a bad line becomes an error and the rest still parses.
 *
 * @see BUILD_PLAN §4.1
 */
export function parseImport(text: string): ParseOutput {
	const { raws, errors } = groupBlocks(text);
	const document: ImportDocument = { blocks: [] };
	for (const raw of raws) {
		const parseBlock = BLOCK_PARSERS.get(raw.name);
		if (!parseBlock) {
			errors.push({
				line: raw.line,
				message: `Unknown directive @${raw.name}; the lines under it were skipped.`
			});
			continue;
		}
		const output = parseBlock(raw);
		errors.push(...output.errors);
		if (output.block) document.blocks.push(output.block);
	}
	errors.sort((a, b) => a.line - b.line);
	return { document, errors };
}
