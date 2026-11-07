import { z } from 'zod';
import {
	CardIdSchema,
	CardStatusSchema,
	CourseIdSchema,
	ExerciseKindSchema,
	MetaSchema,
	NoteIdSchema
} from './common.ts';

/**
 * The ts-fsrs 6 card state, with dates as epoch ms. The field names are the library's.
 *
 * @see DATA_MODEL §4.5
 */
export const FsrsCardStateSchema = z.object({
	due: z.number(),
	stability: z.number(),
	difficulty: z.number(),
	scheduled_days: z.number(),
	learning_steps: z.number(),
	reps: z.number(),
	lapses: z.number(),
	state: z.number(),
	last_review: z.number().optional()
});
export type FsrsCardState = z.infer<typeof FsrsCardStateSchema>;

/**
 * The fields rebuilt by `replay()`. Never written anywhere else, never exported.
 *
 * @see DATA_MODEL §3.5
 * @see CLAUDE.md rule 5
 */
export const CardCachesSchema = z.object({
	fsrs: FsrsCardStateSchema.nullable(),
	due: z.number().optional(),
	status: CardStatusSchema,
	fragile: z.boolean(),
	weak: z.boolean(),
	daysCorrect: z.number().int().min(0),
	pathStep: z.number().int().min(0),
	accuracy: z.object({ n: z.number().int().min(0), correct: z.number().int().min(0) })
});
export type CardCaches = z.infer<typeof CardCachesSchema>;

/** A card nobody has studied yet. @see DATA_MODEL §3.5 */
export const EMPTY_CARD_CACHES: CardCaches = {
	fsrs: null,
	status: 'unseen',
	fragile: false,
	weak: false,
	daysCorrect: 0,
	pathStep: 0,
	accuracy: { n: 0, correct: 0 }
};

/** @see DATA_MODEL §3.5 */
export const CardSchema = MetaSchema.extend({
	id: CardIdSchema,
	noteId: NoteIdSchema,
	courseId: CourseIdSchema,
	variant: z.string().min(1),
	path: z.array(ExerciseKindSchema).min(1),
	suspended: z.boolean()
}).extend(CardCachesSchema.shape);
export type Card = z.infer<typeof CardSchema>;
