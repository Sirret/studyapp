import type { ImportDocument, ImportError } from './ast.ts';
import { BLOCK_PARSERS, type RawBlock } from './block-parsers.ts';
import { lex } from './lexer.ts';
import { MAP_BLOCK_PARSERS } from './map-parsers.ts';
import { prepareSource } from './source.ts';

/** Every directive's parser: the original set plus Import v2's. */
const PARSERS = new Map([...BLOCK_PARSERS, ...MAP_BLOCK_PARSERS]);

/** The valid blocks of an import text, plus an error for each line that isn't valid. */
export interface ParseOutput {
	document: ImportDocument;
	errors: ImportError[];
	/** Skipped but harmless: unknown directives, text outside the import (never blocks). */
	warnings: ImportError[];
}

/** Gathers each directive with the text lines under it. */
function groupBlocks(source: string): RawBlock[] {
	const raws: RawBlock[] = [];
	for (const token of lex(source)) {
		if (token.kind === 'directive') raws.push({ ...token, lines: [] });
		else raws.at(-1)?.lines.push(token);
	}
	return raws;
}

/**
 * Parses import text. Never throws: a bad line becomes an error and the rest still parses. Text
 * that isn't import text and unknown directives become warnings.
 *
 * @see BUILD_PLAN §4.1, docs/PROMPTS.md §7 and Decisions log (Import v2: robust parsing)
 */
export function parseImport(text: string): ParseOutput {
	const prepared = prepareSource(text);
	const errors: ImportError[] = [];
	const warnings: ImportError[] = [...prepared.warnings];
	const document: ImportDocument = { blocks: [] };
	for (const raw of groupBlocks(prepared.text)) {
		// Directive names are case-insensitive (PROMPTS §7); Map lookup keeps prototype names (@constructor) out.
		const key = raw.name.toLowerCase();
		const parseBlock = PARSERS.get(key);
		if (!parseBlock) {
			warnings.push({
				line: raw.line,
				message: `Unknown directive @${raw.name}; it and the lines under it were skipped.`
			});
			continue;
		}
		const output = parseBlock({ ...raw, name: key });
		errors.push(...output.errors);
		if (output.block) document.blocks.push(output.block);
	}
	errors.sort((a, b) => a.line - b.line);
	warnings.sort((a, b) => a.line - b.line);
	return { document, errors, warnings };
}
