import { z } from 'zod';
import {
	ChunkIdSchema,
	CourseColorSchema,
	CourseIdSchema,
	ExamFormatSchema,
	LocalDateSchema,
	LocalTimeSchema,
	MediaIdSchema,
	MetaSchema,
	PlacementSchema,
	PrioritySchema,
	TopicIdSchema
} from './common.ts';
import { SettingsSchema } from './kv.ts';

const COURSE_NAME_MAX = 120;

/** @see DATA_MODEL §3.1 */
export const CourseSchema = MetaSchema.extend({
	id: CourseIdSchema,
	name: z.string().min(1).max(COURSE_NAME_MAX),
	status: z.enum(['active', 'archived']),
	examDate: LocalDateSchema.optional(),
	examTime: LocalTimeSchema.optional(),
	examFormat: ExamFormatSchema,
	color: CourseColorSchema,
	settingsOverride: SettingsSchema.partial().optional()
});
export type Course = z.infer<typeof CourseSchema>;

/** @see DATA_MODEL §3.2 */
export const TopicSchema = MetaSchema.extend({
	id: TopicIdSchema,
	courseId: CourseIdSchema,
	name: z.string().min(1),
	order: z.number().int().min(0),
	placement: PlacementSchema,
	priority: PrioritySchema
});
export type Topic = z.infer<typeof TopicSchema>;

/** @see DATA_MODEL §3.3 */
export const ChunkSchema = MetaSchema.extend({
	id: ChunkIdSchema,
	topicId: TopicIdSchema,
	order: z.number().int().min(0),
	text: z.string(),
	words: z.number().int().min(0),
	source: z.enum(['notes', 'generated']),
	splitFlag: z.literal(true).optional(),
	reported: z.literal(true).optional()
});
export type Chunk = z.infer<typeof ChunkSchema>;

/** @see DATA_MODEL §3.8 */
export const MediaSchema = MetaSchema.extend({
	id: MediaIdSchema,
	hash: z.string().regex(/^[0-9a-f]{64}$/),
	mime: z.literal('image/webp'),
	width: z.number().int().positive(),
	height: z.number().int().positive(),
	bytes: z.number().int().min(0),
	blob: z.instanceof(Blob),
	fileName: z.string().optional()
});
export type Media = z.infer<typeof MediaSchema>;
