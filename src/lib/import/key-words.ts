/** A `@fact` definition read for its key words. */
export interface KeyWordReading {
	/** The definition as shown: `*…*` markers removed. */
	text: string;
	/** The starred phrases, in order (idea units). */
	keyWords: string[];
	/** The definition is only starred items in a list ("*a*, *b* and *c*"). */
	list: boolean;
}

const STARRED = /\*([^*\n]+?)\*/g;
/** What may sit between the items of a starred list. */
const LIST_GLUE = /^(?:\s*,\s*(?:and\s+)?|\s+and\s+)$/;

/**
 * Reads `*key words*` in a `@fact` definition: strips the markers for display, keeps the phrases
 * as idea units, and spots a definition that is only a starred list (items joined by ", " and/or
 * " and "; a list needs at least two items).
 *
 * @see docs/PROMPTS.md §3 (CARD RULES), §6, §7 and Decisions log (Import v2: key words)
 */
export function readKeyWords(definition: string): KeyWordReading {
	const keyWords: string[] = [];
	const between: string[] = [];
	let last = 0;
	for (const match of definition.matchAll(STARRED)) {
		between.push(definition.slice(last, match.index));
		keyWords.push((match[1] ?? '').trim());
		last = match.index + match[0].length;
	}
	const tail = definition.slice(last);
	const text = definition.replace(STARRED, (_, phrase: string) => phrase.trim());
	const list =
		keyWords.length >= 2 &&
		between[0]?.trim() === '' &&
		tail.trim() === '' &&
		between.slice(1).every((glue) => LIST_GLUE.test(glue));
	return { text, keyWords, list };
}
