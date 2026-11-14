const BYTE_ORDER_MARK = '﻿';
const LINE_BREAK = /\r\n|\r|\n/;
const CHECK_MARKER = /\s*\[CHECK\]$/;
const ADDED_MARKER = /\s*\[ADDED\]$/;

/** A line of ordinary text. */
export interface TextToken {
	kind: 'text';
	line: number;
	text: string;
	isChecked: boolean;
	/** Ended with `[ADDED]` (PROMPTS §3): the chatbot added this card. */
	isAdded: boolean;
}

/** A line that opens a block: `@name argument`. */
export interface DirectiveToken {
	kind: 'directive';
	line: number;
	name: string;
	argument: string;
	isChecked: boolean;
}

export type Token = TextToken | DirectiveToken;

/** Trims a line and removes its trailing `[CHECK]` and `[ADDED]` markers. @see BUILD_PLAN §4.1 */
export function readLine(raw: string): { text: string; isChecked: boolean; isAdded: boolean } {
	const trimmed = raw.trim();
	const unadded = trimmed.replace(ADDED_MARKER, '');
	const text = unadded.replace(CHECK_MARKER, '');
	return { text, isChecked: text !== unadded, isAdded: unadded !== trimmed };
}

function directiveToken(line: number, text: string, isChecked: boolean): DirectiveToken {
	const nameEnd = text.search(/\s/);
	return nameEnd === -1
		? { kind: 'directive', line, name: text.slice(1), argument: '', isChecked }
		: {
				kind: 'directive',
				line,
				name: text.slice(1, nameEnd),
				argument: text.slice(nameEnd).trim(),
				isChecked
			};
}

/** The lines of import text, without a byte order mark. `lines[n - 1]` is line n. */
export function splitLines(source: string): string[] {
	const body = source.startsWith(BYTE_ORDER_MARK) ? source.slice(1) : source;
	return body.split(LINE_BREAK);
}

/**
 * Splits import text into tokens, one per non-blank line, keeping real line numbers.
 *
 * @see BUILD_PLAN §4.1
 */
export function lex(source: string): Token[] {
	const tokens: Token[] = [];
	splitLines(source).forEach((raw, index) => {
		const { text, isChecked, isAdded } = readLine(raw);
		const line = index + 1;
		if (text === '') return;
		tokens.push(
			text.startsWith('@')
				? directiveToken(line, text, isChecked)
				: { kind: 'text', line, text, isChecked, isAdded }
		);
	});
	return tokens;
}
