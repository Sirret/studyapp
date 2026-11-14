/** A lecture written only as a roman numeral or a number ("V", "12"). */
const BARE_LECTURE = /^(?:[IVXLCDM]+|\d+)$/i;
const LECTURE_PREFIX = 'Lecture ';

/** "lecture v" → "Lecture V"; "V" → "Lecture V"; anything else as written. */
function normalizeOne(raw: string): string {
	const text = raw.trim().replace(/\s+/g, ' ');
	const named = /^lecture\s+(.+)$/i.exec(text);
	const number = named?.[1] ?? text;
	if (!BARE_LECTURE.test(number)) return text;
	return LECTURE_PREFIX + (/^\d+$/.test(number) ? number : number.toUpperCase());
}

/**
 * `from: Lecture I, Lecture V` or `from: I, V`: the lecture names a topic came from, normalised to
 * "Lecture I" so re-imports match whichever way the chatbot wrote them. Empty parts are dropped.
 *
 * @see docs/PROMPTS.md §3 FORMAT, §7 and Decisions log (Import v2: topics by key)
 */
export function normalizeFrom(raw: string): string[] {
	return raw
		.split(',')
		.map(normalizeOne)
		.filter((name) => name !== '');
}

/** Whether two topics share a lecture (normalised names, compared without case). */
export function sharesLecture(a: readonly string[], b: readonly string[]): boolean {
	const names = new Set(a.map((name) => normalizeOne(name).toLowerCase()));
	return b.some((name) => names.has(normalizeOne(name).toLowerCase()));
}
