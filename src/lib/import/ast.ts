import { z } from 'zod';
import { PrioritySchema } from '#lib/db/schemas/common.ts';
import { MIN_STEPS } from '#lib/db/schemas/note.ts';

const MIN_COMPARE_ITEMS = 2;
const MIN_STACK_LAYERS = 2;

const LineSchema = z.number().int().positive();
const TextSchema = z.string().min(1);

/** A problem in the pasted text, shown in the preview next to its line number. @see BUILD_PLAN §4.1 */
export interface ImportError {
	line: number;
	message: string;
}

/** One `left :: right` line, which becomes one note. */
const PairEntrySchema = z.object({
	line: LineSchema,
	left: TextSchema,
	right: TextSchema,
	isChecked: z.boolean()
});
export type PairEntry = z.infer<typeof PairEntrySchema>;

const pairBlock = <K extends string>(kind: K) =>
	z.object({
		kind: z.literal(kind),
		line: LineSchema,
		entries: z.array(PairEntrySchema).min(1, `@${kind} has no valid lines.`)
	});

const blockBase = { line: LineSchema, isChecked: z.boolean() };
const SourceFileSchema = TextSchema.optional();

/**
 * The parsed import text: one validated record per `@` block, in file order.
 *
 * @see BUILD_PLAN §4.1
 */
export const BlockSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('deck'), line: LineSchema, name: TextSchema }),
	z.object({ kind: z.literal('tag'), line: LineSchema, name: TextSchema }),
	z.object({ kind: z.literal('priority'), line: LineSchema, value: PrioritySchema }),
	pairBlock('keyterms'),
	z.object({
		kind: z.literal('read'),
		...blockBase,
		text: TextSchema,
		isGenerated: z.boolean()
	}),
	pairBlock('fact'),
	z.object({
		kind: z.literal('cloze'),
		line: LineSchema,
		entries: z
			.array(z.object({ line: LineSchema, text: TextSchema, isChecked: z.boolean() }))
			.min(1, '@cloze has no valid lines.')
	}),
	z.object({
		kind: z.literal('sequence'),
		...blockBase,
		name: TextSchema,
		steps: z.array(TextSchema).min(MIN_STEPS, `@sequence needs at least ${MIN_STEPS} steps.`)
	}),
	z.object({
		kind: z.literal('compare'),
		...blockBase,
		items: z
			.array(TextSchema)
			.min(MIN_COMPARE_ITEMS, `@compare needs at least ${MIN_COMPARE_ITEMS} items.`),
		rows: z
			.array(z.object({ attribute: TextSchema, values: z.array(TextSchema) }))
			.min(1, '@compare needs at least one row under its item names.')
	}),
	pairBlock('scenario'),
	z.object({
		kind: z.literal('example'),
		...blockBase,
		name: TextSchema,
		steps: z
			.array(z.object({ subgoal: TextSchema, step: TextSchema }))
			.min(MIN_STEPS, `@example needs at least ${MIN_STEPS} steps.`)
	}),
	z.object({
		kind: z.literal('diagramStack'),
		...blockBase,
		name: TextSchema,
		sourceFile: SourceFileSchema,
		layers: z
			.array(z.object({ label: TextSchema, role: TextSchema.optional() }))
			.min(MIN_STACK_LAYERS, `@diagram stack needs at least ${MIN_STACK_LAYERS} layers.`)
	}),
	z.object({
		kind: z.literal('diagramFlow'),
		...blockBase,
		name: TextSchema,
		sourceFile: SourceFileSchema,
		edges: z
			.array(z.object({ from: TextSchema, to: TextSchema, label: TextSchema.optional() }))
			.min(1, '@diagram flow needs at least one arrow.')
	}),
	z.object({ kind: z.literal('occlusion'), ...blockBase, file: TextSchema }),
	z.object({
		kind: z.literal('coverage'),
		line: LineSchema,
		sections: z.array(TextSchema).min(1, '@coverage has no sections.')
	}),
	/** The chatbot finished its reply (BUILD_PLAN §4.1); without it the reply may be cut off. */
	z.object({ kind: z.literal('end'), line: LineSchema })
]);
export type Block = z.infer<typeof BlockSchema>;

/** @see BUILD_PLAN §4.1 */
export const ImportDocumentSchema = z.object({ blocks: z.array(BlockSchema) });
export type ImportDocument = z.infer<typeof ImportDocumentSchema>;
