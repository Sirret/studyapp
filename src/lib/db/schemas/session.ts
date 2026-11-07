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
	done: z.boolean(),
	/** Its next answer is its first attempt ever, with no pretest (known-on-first-try can apply). */
	firstEver: z.boolean()
});
export type SessionCard = z.infer<typeof SessionCardSchema>;

/** The current round of at most `ROUND_WORKING_SET` cards. @see DATA_MODEL §3.7, BUILD_PLAN §6.4 */
export const SessionRoundSchema = z.object({
	index: z.number().int().min(1),
	startedAt: z.number(),
	answers: z.number().int().min(0),
	cards: z.array(CardIdSchema),
	ended: z.boolean()
});
export type SessionRound = z.infer<typeof SessionRoundSchema>;

/**
 * The round's cards in play (head = current card), cards not yet in play, per-card state, the
 * card being cleared by redo-till-right, whether cleanup has started, the current round, and when
 * study started or the last break ended. Saved after every answer so a closed tab resumes.
 *
 * @see DATA_MODEL §3.7
 */
export const SessionSnapshotSchema = z.object({
	queue: z.array(CardIdSchema),
	backlog: z.array(CardIdSchema),
	cards: z.record(CardIdSchema, SessionCardSchema),
	clearing: CardIdSchema.nullable(),
	cleanup: z.boolean(),
	round: SessionRoundSchema,
	studySince: z.number()
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
