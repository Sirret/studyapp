import { ITEM_ROWS_SHOWN, MC_OPTIONS } from '#lib/config/defaults.ts';
import { baseOf, fallback, shuffled, type BuildContext, type Built } from './exercise-context.ts';
import { variantIndexes } from './exercise-prompts.ts';
import type { ExerciseNote } from './exercise-types.ts';
import { normalizeAnswer } from './grading.ts';

type CompareNote = Extract<ExerciseNote, { type: 'compare' }>;

function compareOf(ctx: BuildContext): CompareNote | null {
	return ctx.note.type === 'compare' ? ctx.note : null;
}

/** `[r, c]` of a `cell:r:c` card, or null. */
function cellOf(ctx: BuildContext): [number, number] | null {
	const cell = variantIndexes(ctx.input.card.variant, 'cell');
	return cell && cell.length === 2 ? [cell[0] as number, cell[1] as number] : null;
}

/** The row a `row:r` card names, else row 0. */
function rowOf(ctx: BuildContext): number {
	return variantIndexes(ctx.input.card.variant, 'row')?.[0] ?? 0;
}

/** Row `r` and the following rows (wrapping), at most `count` distinct ones. */
function rowsFrom(r: number, total: number, count: number): number[] {
	return Array.from({ length: Math.min(count, total) }, (_unused, i) => (r + i) % total);
}

function valueAt(note: CompareNote, r: number, c: number): string {
	return note.payload.rows[r]?.values[c] ?? '';
}

/** `oddOneOut`: three values of one item, and one of the next item. @see BUILD_PLAN §5.1 */
export function buildOddOneOut(ctx: BuildContext): Built {
	const note = compareOf(ctx);
	const cell = cellOf(ctx);
	if (!note || !cell || note.payload.rows.length < 3)
		return fallback('mc', 'needs a cell of 3 rows');
	const [r, c] = cell;
	const items = note.payload.items.length;
	const three = rowsFrom(r, note.payload.rows.length, 3).map((row) => valueAt(note, row, c));
	const odd = valueAt(note, r, (c + 1) % items);
	const normal = new Set(three.map(normalizeAnswer));
	if (normal.size < 3 || normal.has(normalizeAnswer(odd))) {
		return fallback('mc', 'values not distinct');
	}
	const { items: options, at } = shuffled([...three, odd], ctx.rng);
	return {
		...baseOf(ctx, 'oddOneOut', 'Three of these describe the same one. Which doesn’t?'),
		shape: 'choose',
		options: options.map((text) => ({ text })),
		correctIndex: at[3] ?? 0,
		letter: null
	};
}

/** Distinct texts after normalising, first spelling kept. */
function distinct(texts: readonly string[], exclude: ReadonlySet<string> = new Set()): string[] {
	const seen = new Set(exclude);
	return texts.filter((text) => {
		const key = normalizeAnswer(text);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** `multiSelect`: which of these describe item c. @see BUILD_PLAN §5.1 */
export function buildMultiSelect(ctx: BuildContext): Built {
	const note = compareOf(ctx);
	const cell = cellOf(ctx);
	if (!note || !cell) return fallback('mc', 'needs a compare cell');
	const [r, c] = cell;
	const rows = rowsFrom(r, note.payload.rows.length, ITEM_ROWS_SHOWN);
	const right = distinct(rows.map((row) => valueAt(note, row, c)));
	const others = rows.flatMap((row) =>
		note.payload.items.flatMap((_item, i) => (i === c ? [] : [valueAt(note, row, i)]))
	);
	const wrong = distinct(others, new Set(right.map(normalizeAnswer)));
	if (wrong.length === 0) return fallback('mc', 'no wrong option');
	const { items: options, at } = shuffled([...right, ...wrong], ctx.rng);
	const correct = right.map((_text, i) => at[i] ?? 0).sort((a, b) => a - b);
	return {
		...baseOf(ctx, 'multiSelect', `Which of these describe ${note.payload.items[c] ?? ''}?`),
		shape: 'chooseMany',
		options: options.map((text) => ({ text })),
		correct
	};
}

/** `pickPrinciple`: which attribute a row's differences are about. @see BUILD_PLAN §5.1 */
export function buildPickPrinciple(ctx: BuildContext): Built {
	const note = compareOf(ctx);
	if (!note) return fallback('mc', 'needs a compare note');
	const { items, rows } = note.payload;
	if (rows.length < 2) return fallback('tableRow', 'one row');
	const r = rowOf(ctx);
	const attributes = rowsFrom(r, rows.length, MC_OPTIONS).map((row) => rows[row]?.attribute ?? '');
	const prompt = items.map((item, c) => `${item}: ${valueAt(note, r, c)}`).join(' · ');
	const { items: options, at } = shuffled(attributes, ctx.rng);
	return {
		...baseOf(ctx, 'pickPrinciple', prompt),
		shape: 'choose',
		options: options.map((text) => ({ text })),
		correctIndex: at[0] ?? 0,
		letter: null
	};
}

/** `tableRow`: match each item to its value in a row. @see BUILD_PLAN §5.1 */
export function buildTableRow(ctx: BuildContext): Built {
	const note = compareOf(ctx);
	if (!note) return fallback('mc', 'needs a compare note');
	const r = rowOf(ctx);
	const attribute = note.payload.rows[r]?.attribute ?? '';
	const values = note.payload.items.map((_item, c) => valueAt(note, r, c));
	const { items: right, at } = shuffled(values, ctx.rng);
	return {
		...baseOf(ctx, 'tableRow', `${attribute}: match each to its value`),
		shape: 'pair',
		left: [...note.payload.items],
		right,
		pairs: values.map((_value, i) => at[i] ?? 0)
	};
}

/** `categorize`: sort every value under its item, leaving out shared values. @see BUILD_PLAN §5.1 */
export function buildCategorize(ctx: BuildContext): Built {
	const note = compareOf(ctx);
	if (!note) return fallback('mc', 'needs a compare note');
	const owners = new Map<string, Set<number>>();
	const values: { text: string; bucket: number }[] = [];
	note.payload.rows.forEach((row) =>
		row.values.forEach((text, c) => {
			const key = normalizeAnswer(text);
			const set = owners.get(key) ?? new Set<number>();
			if (!owners.has(key)) values.push({ text, bucket: c });
			set.add(c);
			owners.set(key, set);
		})
	);
	const kept = values.filter((value) => owners.get(normalizeAnswer(value.text))?.size === 1);
	if (kept.length < 2) return fallback('tableRow', 'fewer than 2 values to sort');
	const { items, at } = shuffled(
		kept.map((value) => value.text),
		ctx.rng
	);
	const bucketOf: number[] = [];
	kept.forEach((value, i) => (bucketOf[at[i] ?? 0] = value.bucket));
	return {
		...baseOf(ctx, 'categorize', 'Sort each into its group'),
		shape: 'sort',
		buckets: [...note.payload.items],
		items,
		bucketOf
	};
}
