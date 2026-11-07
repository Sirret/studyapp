import { z } from 'zod';
import { CardIdSchema, CourseIdSchema, ModeSchema, SessionIdSchema } from './common.ts';

/** @see DATA_MODEL §3.7 */
export const SessionPhaseSchema = z.enum(['warmup', 'new', 'recall', 'discrimination', 'cleanup']);
export type SessionPhase = z.infer<typeof SessionPhaseSchema>;

/** One card's progress inside a session. @see DATA_MODEL §3.7 and BUILD_PLAN §6.3, §6.4 */
export const SessionCardSchema = z.object({
	phase: SessionPhaseSchema,
	required: z.number().int().min(1),
	count: z.number().int().min(0),
	lastFull: z.boolean(),
	failed: z.boolean(),
	attempt: z.number().int().min(0),
	done: z.boolean()
});
export type SessionCard = z.infer<typeof SessionCardSchema>;

/**
 * Queue (head = current card), per-card state, the card being cleared by redo-till-right, and
 * whether cleanup has started. Saved after every answer so a closed tab resumes.
 *
 * @see DATA_MODEL §3.7
 */
export const SessionSnapshotSchema = z.object({
	queue: z.array(CardIdSchema),
	cards: z.record(z.string(), SessionCardSchema),
	clearing: CardIdSchema.nullable(),
	cleanup: z.boolean()
});
export type SessionSnapshot = z.infer<typeof SessionSnapshotSchema>;

/** @see DATA_MODEL §3.7 */
export const SessionSchema = z.object({
	id: SessionIdSchema,
	mode: ModeSchema,
	courseIds: z.array(CourseIdSchema),
	startedAt: z.number(),
	endedAt: z.number().optional(),
	plannedMinutes: z.number().min(0),
	phase: SessionPhaseSchema,
	snapshot: SessionSnapshotSchema
});
export type Session = z.infer<typeof SessionSchema>;
