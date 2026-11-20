/**
 * The reader's text model: a section's text split into paragraphs, with the first appearance of
 * each section term marked so the reader can underline it (KeyTerm).
 *
 * @see DESIGN §7 KeyTerm, §10 Reader; Decisions log "Phase 8.6" (reader key-term underlines)
 */

/** A run of paragraph text; `term` runs are shown as a KeyTerm. */
export interface ReaderSegment {
	text: string;
	term: boolean;
}

/** The text's paragraphs: split on blank lines, trimmed, empties dropped. */
export function paragraphsOf(text: string): string[] {
	return text
		.split(/\n\s*\n/u)
		.map((part) => part.trim())
		.filter((part) => part !== '');
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/** One pattern matching any term as whole words, longest first so "TCP/IP" wins over "TCP". */
function termPattern(terms: readonly string[]): RegExp | null {
	const unique = [...new Set(terms.map((t) => t.trim()).filter((t) => t !== ''))];
	if (unique.length === 0) return null;
	const body = unique
		.sort((a, b) => b.length - a.length)
		.map(escape)
		.join('|');
	return new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, 'giu');
}

/** Splits one paragraph, marking terms not yet in `seen` (lower-cased) and adding them to it. */
function markParagraph(paragraph: string, pattern: RegExp, seen: Set<string>): ReaderSegment[] {
	const segments: ReaderSegment[] = [];
	let plain = '';
	let last = 0;
	for (const match of paragraph.matchAll(pattern)) {
		const key = match[0].toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		plain += paragraph.slice(last, match.index);
		if (plain !== '') segments.push({ text: plain, term: false });
		segments.push({ text: match[0], term: true });
		plain = '';
		last = match.index + match[0].length;
	}
	plain += paragraph.slice(last);
	if (plain !== '') segments.push({ text: plain, term: false });
	return segments;
}

/**
 * The section as paragraphs of segments: each term (case-insensitive, whole words) is marked at
 * its first appearance in the section only; later mentions stay plain text.
 */
export function markSection(text: string, terms: readonly string[]): ReaderSegment[][] {
	const pattern = termPattern(terms);
	const paragraphs = paragraphsOf(text);
	if (pattern === null) return paragraphs.map((p) => [{ text: p, term: false }]);
	const seen = new Set<string>();
	return paragraphs.map((p) => markParagraph(p, pattern, seen));
}
