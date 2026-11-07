import { z } from 'zod';
import {
	CardIdSchema,
	DeviceIdSchema,
	EventIdSchema,
	ExerciseKindSchema,
	ModeSchema,
	NoteIdSchema,
	SessionIdSchema,
	WeightSchema
} from './common.ts';

const EventBaseSchema = z.object({
	id: EventIdSchema,
	ts: z.number(),
	deviceId: DeviceIdSchema,
	seq: z.number().int().positive()
});

/**
 * The append-only history, as a union on `type`.
 *
 * @see DATA_MODEL §3.6
 */
export const StudyEventSchema = z.discriminatedUnion('type', [
	EventBaseSchema.extend({
		type: z.literal('review'),
		cardId: CardIdSchema,
		sessionId: SessionIdSchema,
		mode: ModeSchema,
		kind: ExerciseKindSchema,
		weight: WeightSchema,
		firstAttempt: z.boolean(),
		correct: z.boolean(),
		responseMs: z.number().min(0),
		chosen: z.string().optional(),
		chosenFromCardId: CardIdSchema.optional(),
		credited: z.boolean(),
		/** The card's criterion count in this session after this answer (BUILD_PLAN §6.3). */
		required: z.number().int().min(1).optional()
	}),
	EventBaseSchema.extend({
		type: z.literal('pretest'),
		cardId: CardIdSchema,
		sessionId: SessionIdSchema,
		skipped: z.boolean(),
		responseMs: z.number().min(0)
	}),
	EventBaseSchema.extend({
		type: z.literal('selfRated'),
		noteId: NoteIdSchema,
		cardId: CardIdSchema.optional(),
		sessionId: SessionIdSchema,
		kind: z.enum(['flip', 'explainIt', 'blurt', 'redraw', 'exampleStudy']),
		checked: z.array(z.string()).optional(),
		missedCardIds: z.array(CardIdSchema).optional(),
		rating: z.enum(['again', 'hard', 'good']).optional()
	}),
	EventBaseSchema.extend({
		type: z.literal('acceptAdded'),
		noteId: NoteIdSchema,
		variant: z.string(),
		value: z.string(),
		reviewEventId: EventIdSchema.optional()
	})
]);
export type StudyEvent = z.infer<typeof StudyEventSchema>;
export type ReviewEvent = Extract<StudyEvent, { type: 'review' }>;

/** Omit that keeps a union a union. */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** What a caller supplies; the repository adds `id`, `ts`, `deviceId` and `seq`. */
export type NewStudyEvent = DistributiveOmit<StudyEvent, 'id' | 'ts' | 'deviceId' | 'seq'>;
