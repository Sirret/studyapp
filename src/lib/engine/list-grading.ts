import { LIST_ALL_ONLY_MAX, LIST_N_MIN, LIST_N_SHARE } from '#lib/config/defaults.ts';
import type { ExerciseKind } from '#lib/db/schemas/common.ts';
import { allowedEdits, normalizeAnswer, osaDistance, textLength } from './grading.ts';
import type { Traced } from './trace.ts';

/** A list grade. @see Decisions log "Phase 8.6 Q9" */
export interface ListGrade {
	correct: boolean;
	/** Item indexes the answer named (each counted once), ascending. */
	valid: number[];
	/** Entry indexes (typed) or option indexes (picked) that are not items of the list, ascending. */
	wrong: number[];
	/** The N the answer needed. */
	required: number;
}

/**
 * N for "name N of M": `ceil(itemCount × LIST_N_SHARE)`, at least `LIST_N_MIN`, at most `itemCount`.
 *
 * @see Decisions log "Phase 8.6 Q9"
 */
export function listRequired(itemCount: number): number {
	return Math.min(itemCount, Math.max(LIST_N_MIN, Math.ceil(itemCount * LIST_N_SHARE)));
}

/**
 * The path of a list fact's card: `listAll` alone when the list has at most `LIST_ALL_ONLY_MAX`
 * items; otherwise `listPick`, `listNot`, `listN`, `listAll` (recognition first, then recall, like
 * other paths). Never a reverse card (cardgen).
 *
 * @see Decisions log "Phase 8.6 Q9"; SESSION_NOTES D4, J
 */
export function listPath(itemCount: number): ExerciseKind[] {
	if (itemCount <= LIST_ALL_ONLY_MAX) return ['listAll'];
	return ['listPick', 'listNot', 'listN', 'listAll'];
}

const ascending = (values: Iterable<number>) => [...values].sort((a, b) => a - b);

/**
 * The item a normalised entry names: an exact match, else the closest item within its tolerance,
 * unless another item is as close (the collision guard among the list's own items).
 */
function itemOf(entry: string, items: readonly string[]): number | null {
	const exact = items.indexOf(entry);
	if (exact >= 0) return exact;
	const distances = items.map((item) => osaDistance(entry, item));
	let best: number | null = null;
	distances.forEach((edits, i) => {
		const fits = edits <= allowedEdits(textLength(items[i] ?? ''));
		if (fits && (best === null || edits < (distances[best] ?? Infinity))) best = i;
	});
	if (best === null) return null;
	const bestEdits = distances[best] ?? Infinity;
	const rival = distances.some((edits, i) => i !== best && edits <= bestEdits);
	return rival ? null : best;
}

/**
 * Grades typed list entries: each non-empty entry is matched to an item with `gradeTyped` (exact,
 * accepted or fuzzy, collision-guarded against the list's other items); an item named twice counts
 * once; an entry matching no item is `wrong`. Correct when `valid.length >= required`; wrong
 * entries don't make it incorrect on their own.
 *
 * @see BUILD_PLAN §5.1 row listN ("validItems >= requiredItems")
 */
export function gradeListTyped(input: {
	cardId: string;
	items: readonly string[];
	typed: readonly string[];
	required: number;
}): Traced<ListGrade> {
	const items = input.items.map(normalizeAnswer);
	const valid = new Set<number>();
	const wrong: number[] = [];
	input.typed.forEach((raw, index) => {
		const entry = normalizeAnswer(raw);
		if (entry === '') return;
		const item = itemOf(entry, items);
		if (item === null) wrong.push(index);
		else valid.add(item);
	});
	const result: ListGrade = {
		correct: valid.size >= input.required,
		valid: ascending(valid),
		wrong,
		required: input.required
	};
	return {
		result,
		trace: [
			{
				rule: 'list.typed',
				cardId: input.cardId,
				valid: result.valid,
				wrong,
				required: input.required
			}
		]
	};
}

/**
 * Grades picked options: correct when no pick is wrong and at least `required` correct options are
 * picked ("Tap four. Two of these are not …", mockup 05).
 *
 * @see Decisions log "Phase 8.6 Q9"
 */
export function gradeListPicked(input: {
	correct: readonly number[];
	picked: readonly number[];
	required: number;
}): Traced<ListGrade> {
	const right = new Set(input.correct);
	const picked = new Set(input.picked);
	const valid = ascending([...picked].filter((i) => right.has(i)));
	const wrong = ascending([...picked].filter((i) => !right.has(i)));
	const result: ListGrade = {
		correct: wrong.length === 0 && valid.length >= input.required,
		valid,
		wrong,
		required: input.required
	};
	return { result, trace: [{ rule: 'list.picked', valid, wrong, required: input.required }] };
}
