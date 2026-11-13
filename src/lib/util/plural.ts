/**
 * "1 card", "2 cards": a count with the right form of its noun. The plural defaults to the noun
 * plus "s"; pass it for irregular nouns ("1 key term", "3 key terms" is regular; "1 comparison
 * table", "2 comparison tables" too).
 *
 * @see DESIGN §11 (copy) and Decisions log (Fix pass: plurals)
 */
export function countOf(n: number, one: string, many = `${one}s`): string {
	return `${n} ${n === 1 ? one : many}`;
}
