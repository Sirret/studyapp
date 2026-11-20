import { z } from 'zod';
import {
	ChunkIdSchema,
	CourseColorSchema,
	CourseIdSchema,
	ExamFormatSchema,
	ImportIdSchema,
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

/** A comparison table: items across, attributes down. @see DATA_MODEL §4.2 `compare` */
const TableSchema = z.object({
	items: z.array(z.string()),
	rows: z.array(z.object({ attribute: z.string(), values: z.array(z.string()) }))
});

/** What the chatbot's goal block asked for (PROMPTS §4). */
export const ImportGoalSchema = z.enum(['learn', 'study', 'cram']);
export type ImportGoal = z.infer<typeof ImportGoalSchema>;

/**
 * The course map from an Import v2 reply: how the topics connect, the exam habit questions, the
 * planned topics and sections, links, the cheat table, what the chatbot couldn't read, and where
 * an unfinished import resumes.
 *
 * @see DATA_MODEL §3.1 `map` and docs/PROMPTS.md §3 FORMAT, §6
 */
export const CourseMapSchema = z.object({
	bigpicture: z.array(z.string()),
	habit: z.array(z.string()),
	topics: z.array(
		z.object({
			key: z.string().min(1),
			title: z.string().min(1),
			from: z.array(z.string()),
			sections: z.array(z.string())
		})
	),
	links: z.array(z.object({ from: z.string(), to: z.string(), how: z.string() })),
	cheat: TableSchema.extend({ name: z.string() }).optional(),
	missing: z.array(z.string()),
	next: z.object({ topicKey: z.string().min(1), section: z.string().optional() }).optional(),
	goal: ImportGoalSchema.optional()
});
export type CourseMap = z.infer<typeof CourseMapSchema>;

/**
 * A topic as it was before an import changed it: only the fields an import writes.
 *
 * @see DATA_MODEL §3.1 (`lastImport`)
 */
export const TopicBeforeImportSchema = z.object({
	id: TopicIdSchema,
	placement: PlacementSchema,
	priority: PrioritySchema,
	key: z.string().min(1).optional(),
	from: z.array(z.string()).optional(),
	summary: z.string().optional(),
	partial: z.literal(true).optional()
});
export type TopicBeforeImport = z.infer<typeof TopicBeforeImportSchema>;

/**
 * What undoing the course's latest import needs: its ID (the records it created carry it), the
 * topics it changed as they were before, and the course map before (`null`: there was none).
 *
 * @see DATA_MODEL §3.1
 */
export const LastImportSchema = z.object({
	importId: ImportIdSchema,
	at: z.number(),
	topicsBefore: z.array(TopicBeforeImportSchema),
	mapBefore: CourseMapSchema.nullable()
});
export type LastImport = z.infer<typeof LastImportSchema>;

/** @see DATA_MODEL §3.1 */
export const CourseSchema = MetaSchema.extend({
	id: CourseIdSchema,
	name: z.string().min(1).max(COURSE_NAME_MAX),
	status: z.enum(['active', 'archived']),
	examDate: LocalDateSchema.optional(),
	examTime: LocalTimeSchema.optional(),
	examFormat: ExamFormatSchema,
	color: CourseColorSchema,
	settingsOverride: SettingsSchema.partial().optional(),
	map: CourseMapSchema.optional(),
	/** The latest import, until it is undone or another import replaces it. */
	lastImport: LastImportSchema.optional()
});
export type Course = z.infer<typeof CourseSchema>;

/** @see DATA_MODEL §3.2 */
export const TopicSchema = MetaSchema.extend({
	id: TopicIdSchema,
	courseId: CourseIdSchema,
	name: z.string().min(1),
	order: z.number().int().min(0),
	placement: PlacementSchema,
	priority: PrioritySchema,
	/** The topic's id in the course map (`@topic <key>`); absent for `@deck` topics. */
	key: z.string().min(1).optional(),
	/** Lecture names it came from, normalised ("Lecture I"); re-imports match on these. Absent = none. */
	from: z.array(z.string()).optional(),
	summary: z.string().optional(),
	/** Some of its sections are still to come (cut-off reply). */
	partial: z.literal(true).optional(),
	/** The import that created it; absent for topics made by hand or before Phase 8.5. */
	importId: ImportIdSchema.optional()
});
export type Topic = z.infer<typeof TopicSchema>;

/**
 * A section of a topic (`@section`, or a legacy `@read`/`@tag`): its reading, title and tip.
 * Stored in the `chunks` table. `text` is empty for a section with no `@read`.
 *
 * @see DATA_MODEL §3.3
 */
export const ChunkSchema = MetaSchema.extend({
	id: ChunkIdSchema,
	topicId: TopicIdSchema,
	order: z.number().int().min(0),
	text: z.string(),
	words: z.number().int().min(0),
	source: z.enum(['notes', 'generated']),
	check: z.literal(true).optional(),
	splitFlag: z.literal(true).optional(),
	reported: z.literal(true).optional(),
	title: z.string().min(1).optional(),
	priority: PrioritySchema.optional(),
	tip: z.string().optional(),
	/** The "Added by the chatbot (check these)" section: reviewed by the student, kept apart. */
	added: z.literal(true).optional(),
	/** The import that created it. */
	importId: ImportIdSchema.optional()
});
export type Chunk = z.infer<typeof ChunkSchema>;

/** @see DATA_MODEL §3.8 */
export const MediaSchema = MetaSchema.extend({
	id: MediaIdSchema,
	hash: z.string().regex(/^[0-9a-f]{64}$/),
	/** SHA-256 of the original file bytes; absent on images stored before Phase 6. */
	sourceHash: z
		.string()
		.regex(/^[0-9a-f]{64}$/)
		.optional(),
	/** JPEG only where the browser can't write WebP (Decisions log "Phase 6 Q6–Q7"). */
	mime: z.enum(['image/webp', 'image/jpeg']),
	width: z.number().int().positive(),
	height: z.number().int().positive(),
	bytes: z.number().int().min(0),
	blob: z.instanceof(Blob),
	fileName: z.string().optional(),
	/** The import that stored it. */
	importId: ImportIdSchema.optional()
});
export type Media = z.infer<typeof MediaSchema>;
