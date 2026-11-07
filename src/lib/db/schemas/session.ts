import { z } from 'zod';
import { CardIdSchema, CourseIdSchema, ModeSchema, SessionIdSchema } from './common.ts';

/** @see DATA_MODEL §3.7 */
export const SessionPhaseSchema = z.enum(['warmup', 'new', 'recall', 'discrimination', 'cleanup']);
export type SessionPhase = z.infer<typeof SessionPhaseSchema>;

/** Queue, per-card counts and attempt numbers, saved after every answer. @see DATA_MODEL §3.7 */
export const SessionSnapshotSchema = z.object({
	queue: z.array(CardIdSchema),
	counts: z.record(z.string(), z.number().int().min(0)),
	attempts: z.record(z.string(), z.number().int().min(0))
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
