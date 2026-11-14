import type { ImportError, PairEntry } from './ast.ts';
import {
	failBlock,
	finishBlock,
	splitPair,
	strayLineErrors,
	type BlockParser,
	type RawBlock
} from './block-parsers.ts';
import { readTable } from './compare-parser.ts';
import { normalizeFrom } from './lectures.ts';

/**
 * Parsers for the Import v2 directives (docs/PROMPTS.md §3 FORMAT, §7). Lenient where the chatbot
 * may vary: an argument on a block directive counts as its first line.
 *
 * @see docs/PROMPTS.md §3, §7 and Decisions log (Import v2: the map)
 */

const FROM = /^from:\s*(.*)$/i;
const LINK = /^(.+?)\s+->\s+(.+?)\s+:\s+(.+)$/;
const NONE = /^none\.?$/i;

/** The text lines of a block, with its argument as the first line when it has one. */
function textLines(raw: RawBlock): string[] {
	return [raw.argument, ...raw.lines.map((line) => line.text)].filter((text) => text !== '');
}

function named(kind: 'map' | 'section'): BlockParser {
	return (raw) => {
		const errors = strayLineErrors(raw);
		if (raw.argument === '') return failBlock(raw, `@${kind} needs a name.`);
		const field = kind === 'map' ? 'name' : 'title';
		return finishBlock(raw, { kind, line: raw.line, [field]: raw.argument }, errors);
	};
}

function lineList(kind: 'bigpicture' | 'habit'): BlockParser {
	return (raw) => {
		const field = kind === 'bigpicture' ? 'lines' : 'questions';
		return finishBlock(raw, { kind, line: raw.line, [field]: textLines(raw) });
	};
}

function joined(kind: 'summary' | 'tip'): BlockParser {
	return (raw) => {
		const text = textLines(raw).join('\n');
		if (text === '') return failBlock(raw, `@${kind} has no text.`);
		return finishBlock(raw, { kind, line: raw.line, text });
	};
}

/** `@topic <key> <title> | from: <lectures>`; its lines, if any, are the map's section titles. */
const parseTopic: BlockParser = (raw) => {
	const [head = '', ...rest] = raw.argument.split(/\s+\|\s+|\s*\|\s*(?=from:)/i);
	const fromPart = rest
		.map((part) => FROM.exec(part.trim())?.[1])
		.find((part) => part !== undefined);
	const [key = '', ...titleWords] = head.trim().split(/\s+/);
	if (key === '' || titleWords.length === 0) {
		return failBlock(raw, '@topic needs an id and a title, like "@topic osi The OSI Model".');
	}
	return finishBlock(raw, {
		kind: 'topic',
		line: raw.line,
		key,
		title: titleWords.join(' '),
		from: fromPart === undefined ? [] : normalizeFrom(fromPart),
		sections: raw.lines.map((line) => line.text)
	});
};

const parseLinks: BlockParser = (raw) => {
	const errors: ImportError[] = [];
	const links = raw.lines.flatMap(({ line, text }) => {
		const match = LINK.exec(text);
		if (match?.[1] && match[2] && match[3])
			return [{ from: match[1], to: match[2], how: match[3] }];
		errors.push({ line, message: 'Expected "topic -> topic : how they connect".' });
		return [];
	});
	return finishBlock(raw, { kind: 'links', line: raw.line, links }, errors);
};

const parseCheat: BlockParser = (raw) => {
	const table = readTable(raw);
	if ('errors' in table) return table;
	return finishBlock(raw, {
		kind: 'cheat',
		line: raw.line,
		name: raw.argument || 'Cheat sheet',
		...table
	});
};

const parseMissing: BlockParser = (raw) => {
	const items = textLines(raw).filter((text) => !NONE.test(text));
	return finishBlock(raw, { kind: 'missing', line: raw.line, items });
};

/** `@link <topic key>` with `question :: answer` lines. */
const parseLink: BlockParser = (raw) => {
	if (raw.argument === '') return failBlock(raw, '@link needs the id of the topic it links to.');
	const errors: ImportError[] = [];
	const entries: PairEntry[] = [];
	for (const { line, text, isChecked, isAdded } of raw.lines) {
		const pair = splitPair(text);
		if (pair) entries.push({ line, ...pair, isChecked, isAdded });
		else errors.push({ line, message: 'Expected "question :: answer".' });
	}
	const topicKey = raw.argument.split(/\s+/)[0];
	if (entries.length === 0)
		return { errors: [...errors, { line: raw.line, message: '@link has no valid lines.' }] };
	return finishBlock(raw, { kind: 'link', line: raw.line, topicKey, entries }, errors);
};

/** `@next <topic key> [section title]`; quotes around the title are dropped. */
const parseNext: BlockParser = (raw) => {
	const [topicKey = '', ...rest] = raw.argument.split(/\s+/);
	if (topicKey === '') return failBlock(raw, '@next needs the id of the topic to resume.');
	const section = rest
		.join(' ')
		.replace(/^["“](.*)["”]$/, '$1')
		.trim();
	return finishBlock(raw, {
		kind: 'next',
		line: raw.line,
		topicKey,
		...(section ? { section } : {})
	});
};

export const MAP_BLOCK_PARSERS: ReadonlyArray<readonly [string, BlockParser]> = [
	['map', named('map')],
	['bigpicture', lineList('bigpicture')],
	['habit', lineList('habit')],
	['topic', parseTopic],
	['links', parseLinks],
	['cheat', parseCheat],
	['missing', parseMissing],
	['summary', joined('summary')],
	['section', named('section')],
	['tip', joined('tip')],
	['link', parseLink],
	['next', parseNext]
];
