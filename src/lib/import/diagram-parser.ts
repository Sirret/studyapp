import type { ImportError } from './ast.ts';
import {
	failBlock,
	finishBlock,
	isBlockChecked,
	splitPair,
	type BlockOutput,
	type RawBlock
} from './block-parsers.ts';

const SKIPPED = ' The @diagram block was skipped.';
const KIND_AND_NAME = /^(stack|flow)\s+(.+)$/;
const SOURCE_LINE = /^source:\s*(.+)$/;
const ARROW = /^(.+?)\s*->\s*(.*)$/;
/** `B : label`, or `B :` with no label. A colon inside a word, as in a URL, is not a separator. */
const ARROW_TARGET = /^(.*?)\s*:(?:\s+(.*))?$/;

interface DiagramLines {
	sourceFile?: string;
	lines: RawBlock['lines'];
}

/** Takes the `source: file` line out of a diagram's lines. */
function separateSource(raw: RawBlock): DiagramLines {
	const lines = raw.lines.filter((line) => !SOURCE_LINE.test(line.text));
	const source = raw.lines.find((line) => SOURCE_LINE.test(line.text));
	const sourceFile = source && SOURCE_LINE.exec(source.text)?.[1];
	return sourceFile ? { sourceFile, lines } : { lines };
}

function parseStack(raw: RawBlock, name: string): BlockOutput {
	const { sourceFile, lines } = separateSource(raw);
	const errors: ImportError[] = [];
	const seen = new Set<string>();
	const layers = lines.map(({ line, text }) => {
		const pair = splitPair(text);
		const label = pair?.left ?? text;
		if (seen.has(label)) {
			errors.push({ line, message: `Layer "${label}" is listed twice.${SKIPPED}` });
		}
		seen.add(label);
		return pair ? { label, role: pair.right } : { label };
	});
	if (errors.length > 0) return { errors };
	return finishBlock(raw, {
		kind: 'diagramStack',
		line: raw.line,
		isChecked: isBlockChecked(raw),
		name,
		...(sourceFile ? { sourceFile } : {}),
		layers
	});
}

/** Reads `A -> B : label`, with the label optional. */
function parseArrow(text: string): { from: string; to: string; label?: string } | undefined {
	const arrow = ARROW.exec(text);
	if (!arrow?.[1] || !arrow[2]) return undefined;
	const target = ARROW_TARGET.exec(arrow[2]);
	const to = target ? target[1] : arrow[2];
	if (!to) return undefined;
	const label = target?.[2];
	return label ? { from: arrow[1], to, label } : { from: arrow[1], to };
}

function parseFlow(raw: RawBlock, name: string): BlockOutput {
	const { sourceFile, lines } = separateSource(raw);
	const errors: ImportError[] = [];
	const edges = lines.flatMap(({ line, text }) => {
		const edge = parseArrow(text);
		if (!edge) {
			errors.push({ line, message: `Expected "A -> B" or "A -> B : label".${SKIPPED}` });
		}
		return edge ? [edge] : [];
	});
	if (errors.length > 0) return { errors };
	return finishBlock(raw, {
		kind: 'diagramFlow',
		line: raw.line,
		isChecked: isBlockChecked(raw),
		name,
		...(sourceFile ? { sourceFile } : {}),
		edges
	});
}

/**
 * Parses `@diagram stack|flow <name>`. A bad line skips the whole diagram, since a missing arrow
 * would teach the wrong structure. A `source: <file>` line names the image it was drawn from.
 *
 * @see BUILD_PLAN §4.1, §4.2 and §7.2
 */
export function parseDiagram(raw: RawBlock): BlockOutput {
	const match = KIND_AND_NAME.exec(raw.argument);
	if (!match?.[2])
		return failBlock(raw, '@diagram must be followed by stack or flow, then a name.');
	return match[1] === 'stack' ? parseStack(raw, match[2]) : parseFlow(raw, match[2]);
}
