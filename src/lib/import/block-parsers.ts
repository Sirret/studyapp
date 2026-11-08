import { CLOZE_SPAN, clozeAnswers } from '#lib/engine/cardgen.ts';
import { BlockSchema, type Block, type ImportError, type PairEntry } from './ast.ts';
import { parseCompare } from './compare-parser.ts';
import { parseDiagram } from './diagram-parser.ts';
import type { DirectiveToken, TextToken } from './lexer.ts';

/** A directive with the text lines under it. */
export interface RawBlock extends DirectiveToken {
	lines: TextToken[];
}

/** A parsed block, if it was valid, and what was wrong with it. */
export interface BlockOutput {
	block?: Block;
	errors: ImportError[];
}

export type BlockParser = (raw: RawBlock) => BlockOutput;

const PAIR = /^(.+?)\s+::\s+(.+)$/;
const GENERATED_PREFIX = /^\[GENERATED\]\s*/;

/** Validates what a block parser built against the AST schema. */
export function finishBlock(
	raw: RawBlock,
	candidate: unknown,
	errors: ImportError[] = []
): BlockOutput {
	const parsed = BlockSchema.safeParse(candidate);
	if (parsed.success) return { block: parsed.data, errors };
	const message = parsed.error.issues[0]?.message ?? `@${raw.name} is not valid.`;
	return { errors: [...errors, { line: raw.line, message }] };
}

export function failBlock(raw: RawBlock, message: string): BlockOutput {
	return { errors: [{ line: raw.line, message }] };
}

/** Whether the block or any line under it has a `[CHECK]` marker. */
export function isBlockChecked(raw: RawBlock): boolean {
	return raw.isChecked || raw.lines.some((line) => line.isChecked);
}

/** Splits `left :: right` on the first spaced `::`, so `std::vector` stays whole. */
export function splitPair(text: string): { left: string; right: string } | undefined {
	const match = PAIR.exec(text);
	return match?.[1] && match[2] ? { left: match[1], right: match[2] } : undefined;
}

/** Reports text under a directive that takes none. */
function strayLineErrors(raw: RawBlock): ImportError[] {
	return raw.lines.map(({ line }) => ({ line, message: `@${raw.name} takes no lines under it.` }));
}

/** Refuses an argument on a directive that takes none. */
function refuseArgument(raw: RawBlock): BlockOutput | undefined {
	return raw.argument === ''
		? undefined
		: failBlock(raw, `@${raw.name} takes nothing on its own line, so this block was skipped.`);
}

function parseNamed(kind: 'deck' | 'tag'): BlockParser {
	return (raw) => {
		const errors = strayLineErrors(raw);
		if (raw.argument === '') {
			return { errors: [{ line: raw.line, message: `@${kind} needs a name.` }, ...errors] };
		}
		return finishBlock(raw, { kind, line: raw.line, name: raw.argument }, errors);
	};
}

const parsePriority: BlockParser = (raw) => {
	const errors = strayLineErrors(raw);
	if (raw.argument !== 'high' && raw.argument !== 'normal') {
		return {
			errors: [{ line: raw.line, message: '@priority must be high or normal.' }, ...errors]
		};
	}
	return finishBlock(raw, { kind: 'priority', line: raw.line, value: raw.argument }, errors);
};

/** One note per line; a bad line is reported and the good ones still import. */
function parsePairs(kind: 'keyterms' | 'fact' | 'scenario', expected: string): BlockParser {
	return (raw) => {
		const refused = refuseArgument(raw);
		if (refused) return refused;
		if (raw.lines.length === 0) return failBlock(raw, `@${kind} has no lines.`);
		const entries: PairEntry[] = [];
		const errors: ImportError[] = [];
		for (const { line, text, isChecked } of raw.lines) {
			const pair = splitPair(text);
			if (pair) entries.push({ line, ...pair, isChecked });
			else errors.push({ line, message: `Expected "${expected}".` });
		}
		if (entries.length === 0) return { errors };
		return finishBlock(raw, { kind, line: raw.line, entries }, errors);
	};
}

const parseRead: BlockParser = (raw) => {
	const refused = refuseArgument(raw);
	if (refused) return refused;
	const joined = raw.lines.map((line) => line.text).join('\n');
	const text = joined.replace(GENERATED_PREFIX, '');
	if (text === '') return failBlock(raw, '@read has no text.');
	return finishBlock(raw, {
		kind: 'read',
		line: raw.line,
		isChecked: isBlockChecked(raw),
		text,
		isGenerated: text !== joined
	});
};

function clozeProblem(text: string): string | undefined {
	const outside = text.replace(CLOZE_SPAN, '');
	const inside = clozeAnswers(text);
	const isUnbalanced =
		outside.includes('{{') || outside.includes('}}') || inside.some((a) => a.includes('{{'));
	if (isUnbalanced) return 'Has an unmatched {{ or }}.';
	if (inside.length === 0) return 'Needs at least one {{answer}}.';
	return inside.includes('') ? 'Has an empty {{ }}.' : undefined;
}

const parseCloze: BlockParser = (raw) => {
	const refused = refuseArgument(raw);
	if (refused) return refused;
	if (raw.lines.length === 0) return failBlock(raw, '@cloze has no lines.');
	const errors: ImportError[] = [];
	const entries = raw.lines.filter(({ line, text }) => {
		const problem = clozeProblem(text);
		if (problem) errors.push({ line, message: problem });
		return !problem;
	});
	if (entries.length === 0) return { errors };
	return finishBlock(
		raw,
		{
			kind: 'cloze',
			line: raw.line,
			entries: entries.map(({ line, text, isChecked }) => ({ line, text, isChecked }))
		},
		errors
	);
};

/** Reports a missing name on a block that needs one. */
function refuseNameless(raw: RawBlock): BlockOutput | undefined {
	return raw.argument === ''
		? failBlock(raw, `@${raw.name} needs a name, so this block was skipped.`)
		: undefined;
}

const parseSequence: BlockParser = (raw) => {
	return (
		refuseNameless(raw) ??
		finishBlock(raw, {
			kind: 'sequence',
			line: raw.line,
			isChecked: isBlockChecked(raw),
			name: raw.argument,
			steps: raw.lines.map((line) => line.text)
		})
	);
};

const parseExample: BlockParser = (raw) => {
	const nameless = refuseNameless(raw);
	if (nameless) return nameless;
	const steps: { subgoal: string; step: string }[] = [];
	const errors: ImportError[] = [];
	for (const { line, text } of raw.lines) {
		const pair = splitPair(text);
		if (pair) steps.push({ subgoal: pair.left, step: pair.right });
		else {
			errors.push({
				line,
				message: 'Expected "subgoal :: step". The @example block was skipped.'
			});
		}
	}
	if (errors.length > 0) return { errors };
	return finishBlock(raw, {
		kind: 'example',
		line: raw.line,
		isChecked: isBlockChecked(raw),
		name: raw.argument,
		steps
	});
};

const parseOcclusion: BlockParser = (raw) => {
	const errors = strayLineErrors(raw);
	if (raw.argument === '') {
		return { errors: [{ line: raw.line, message: '@occlusion needs a file name.' }, ...errors] };
	}
	return finishBlock(
		raw,
		{ kind: 'occlusion', line: raw.line, isChecked: raw.isChecked, file: raw.argument },
		errors
	);
};

const parseCoverage: BlockParser = (raw) => {
	const sections = raw.lines
		.flatMap((line) => line.text.split(','))
		.map((section) => section.trim())
		.filter((section) => section !== '');
	return refuseArgument(raw) ?? finishBlock(raw, { kind: 'coverage', line: raw.line, sections });
};

/**
 * The parser for each directive. A `Map`, so `@constructor` can't find something on an object.
 *
 * @see BUILD_PLAN §4.1
 */
export const BLOCK_PARSERS: ReadonlyMap<string, BlockParser> = new Map<string, BlockParser>([
	['deck', parseNamed('deck')],
	['tag', parseNamed('tag')],
	['priority', parsePriority],
	['keyterms', parsePairs('keyterms', 'term :: short meaning')],
	['read', parseRead],
	['fact', parsePairs('fact', 'term :: definition')],
	['cloze', parseCloze],
	['sequence', parseSequence],
	['compare', (raw) => refuseArgument(raw) ?? parseCompare(raw)],
	['scenario', parsePairs('scenario', 'situation :: answer')],
	['example', parseExample],
	['diagram', parseDiagram],
	['occlusion', parseOcclusion],
	['coverage', parseCoverage],
	['end', (raw) => refuseArgument(raw) ?? finishBlock(raw, { kind: 'end', line: raw.line })]
]);
