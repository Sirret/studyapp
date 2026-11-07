import { z } from 'zod';

/** Branded IDs, so they can't be mixed up (BUILD_PLAN §15.3). */
export const CourseIdSchema = z.uuid().brand<'CourseId'>();
export const TopicIdSchema = z.uuid().brand<'TopicId'>();
export const ChunkIdSchema = z.uuid().brand<'ChunkId'>();
export const NoteIdSchema = z.uuid().brand<'NoteId'>();
export const CardIdSchema = z.uuid().brand<'CardId'>();
export const EventIdSchema = z.uuid().brand<'EventId'>();
export const SessionIdSchema = z.uuid().brand<'SessionId'>();
export const MediaIdSchema = z.uuid().brand<'MediaId'>();
export const DeviceIdSchema = z.uuid().brand<'DeviceId'>();
export type CourseId = z.infer<typeof CourseIdSchema>;
export type TopicId = z.infer<typeof TopicIdSchema>;
export type ChunkId = z.infer<typeof ChunkIdSchema>;
export type NoteId = z.infer<typeof NoteIdSchema>;
export type CardId = z.infer<typeof CardIdSchema>;
export type EventId = z.infer<typeof EventIdSchema>;
export type SessionId = z.infer<typeof SessionIdSchema>;
export type MediaId = z.infer<typeof MediaIdSchema>;
export type DeviceId = z.infer<typeof DeviceIdSchema>;

/** Fields on every content record, apart from its typed `id`. @see DATA_MODEL §2 */
export const MetaSchema = z.object({
	createdAt: z.number(),
	updatedAt: z.number(),
	deviceId: DeviceIdSchema,
	deleted: z.literal(true).optional()
});
export type Meta = z.infer<typeof MetaSchema>;

/** @see DATA_MODEL §4.4 */
export const ModeSchema = z.enum(['acquisition', 'cram', 'longterm', 'onenight']);
export type Mode = z.infer<typeof ModeSchema>;

/** @see DATA_MODEL §4.4 */
export const CardStatusSchema = z.enum([
	'unseen',
	'learning',
	'needs-work',
	'provisional',
	'exam-ready',
	'secure',
	'one-night'
]);
export type CardStatus = z.infer<typeof CardStatusSchema>;

/** @see DATA_MODEL §4.4 */
export const ExerciseKindSchema = z.enum([
	'cloze',
	'firstLetterType',
	'fadeStep',
	'newInstance',
	'sequence',
	'parsons',
	'subgoalMatch',
	'occlusionType',
	'occlusionDrag',
	'structureRebuild',
	'layerOrder',
	'nodeCloze',
	'edgeCloze',
	'categorize',
	'oddOneOut',
	'whichOne',
	'scenario',
	'tableRow',
	'pickPrinciple',
	'mc',
	'multiSelect',
	'occlusionBank',
	'firstLetterBank',
	'matching',
	'hotspot',
	'pretest',
	'flip',
	'explainIt',
	'blurt',
	'redraw',
	'exampleStudy'
]);
export type ExerciseKind = z.infer<typeof ExerciseKindSchema>;

/** @see DATA_MODEL §4.4 */
export const WeightSchema = z.enum(['full', 'recognition', 'none']);
export type Weight = z.infer<typeof WeightSchema>;

/** @see DATA_MODEL §4.4 */
export const PrioritySchema = z.enum(['high', 'normal']);
export type Priority = z.infer<typeof PrioritySchema>;

/** @see DATA_MODEL §4.4 */
export const PlacementSchema = z.enum(['unread', 'read']);
export type Placement = z.infer<typeof PlacementSchema>;

/** @see DATA_MODEL §4.4 */
export const ExamFormatSchema = z.enum(['recall', 'recognition', 'mixed']);
export type ExamFormat = z.infer<typeof ExamFormatSchema>;

/** @see DATA_MODEL §3.1 */
export const CourseColorSchema = z.enum(['lavender', 'peach', 'sage', 'sky', 'rose', 'butter']);
export type CourseColor = z.infer<typeof CourseColorSchema>;

/** Material types, for `p0` defaults. @see DATA_MODEL §4.1 */
export const MaterialSchema = z.enum(['fact', 'concept', 'procedure', 'diagram', 'comparison']);
export type Material = z.infer<typeof MaterialSchema>;

/** `YYYY-MM-DD`, local. */
export const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** `HH:mm`, local. */
export const LocalTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
