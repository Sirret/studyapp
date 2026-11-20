import { z } from 'zod';
import {
	DEFAULT_DAY_MINUTES,
	DEFAULT_EXAM_MORNING_MINUTES,
	DEFAULT_SLEEP_WINDOW,
	RETENTION,
	RETENTION_MAX,
	RETENTION_MIN
} from '#lib/config/defaults.ts';
import {
	DeviceIdSchema,
	ExerciseKindSchema,
	LocalDateSchema,
	LocalTimeSchema,
	MaterialSchema,
	CourseIdSchema,
	TopicIdSchema,
	ChunkIdSchema
} from './common.ts';

/**
 * A course's study selection (SESSION_NOTES §J). Both lists empty = the whole course; otherwise a
 * card is in scope when its topic is listed or its section is listed.
 *
 * @see DATA_MODEL §5
 */
export const StudyScopeSchema = z.object({
	topicIds: z.array(TopicIdSchema),
	chunkIds: z.array(ChunkIdSchema)
});
export type StudyScope = z.infer<typeof StudyScopeSchema>;

/** @see DATA_MODEL §5 */
export const SettingsSchema = z.object({
	retention: z.number().min(RETENTION_MIN).max(RETENTION_MAX),
	spellingMode: z.enum(['fuzzy', 'firstLetter']),
	exercises: z.partialRecord(ExerciseKindSchema, z.boolean()),
	occlusionMode: z.enum(['hideOne', 'hideAll']),
	acquisition: z.object({
		pretest: z.boolean(),
		path: z.enum(['auto', 'full', 'quick']),
		deadlineOrder: z.enum(['breadth', 'depth'])
	}),
	theme: z.enum(['system', 'light', 'dark', 'auto-night']),
	companion: z.enum(['full', 'quiet', 'off']),
	companionName: z.string().min(1),
	haptics: z.boolean(),
	/** Sound effects (SESSION_NOTES D7); a default so settings stored before 8.6 still parse. */
	sounds: z.boolean().default(true),
	/** Instrumental music; the toggle stays hidden until Phase 10 (Decisions log, Phase 8.6 Q11). */
	music: z.boolean().default(false),
	debugLogging: z.boolean()
});
export type Settings = z.infer<typeof SettingsSchema>;

/** Used until the student changes something; a missing exercise key means enabled. @see DATA_MODEL §5 */
export const DEFAULT_SETTINGS: Settings = {
	retention: RETENTION,
	spellingMode: 'fuzzy',
	exercises: {},
	occlusionMode: 'hideOne',
	acquisition: { pretest: true, path: 'auto', deadlineOrder: 'breadth' },
	theme: 'system',
	companion: 'full',
	companionName: 'Yuki',
	haptics: true,
	sounds: true,
	music: false,
	debugLogging: false
};

const WEEKDAYS = 7;

/** @see DATA_MODEL §5 */
export const AvailabilitySchema = z.object({
	weekdayMinutes: z.array(z.number().min(0)).length(WEEKDAYS),
	overrides: z.array(z.object({ date: LocalDateSchema, minutes: z.number().min(0) })),
	sleepWindow: z.object({ start: LocalTimeSchema, end: LocalTimeSchema }),
	examMorningMinutes: z.number().min(0)
});
export type Availability = z.infer<typeof AvailabilitySchema>;

/** Used until the student sets their availability. @see DATA_MODEL §5 */
export const DEFAULT_AVAILABILITY: Availability = {
	weekdayMinutes: Array.from({ length: WEEKDAYS }, () => DEFAULT_DAY_MINUTES),
	overrides: [],
	sleepWindow: { ...DEFAULT_SLEEP_WINDOW },
	examMorningMinutes: DEFAULT_EXAM_MORNING_MINUTES
};

/**
 * Every `kv` key and the schema of its value. Reads are validated against this.
 *
 * @see DATA_MODEL §5
 * @see BUILD_PLAN §15.3
 */
export const KV_SCHEMAS = {
	deviceId: DeviceIdSchema,
	seq: z.number().int().positive(),
	schemaVersion: z.number().int().positive(),
	settings: SettingsSchema,
	availability: AvailabilitySchema,
	fsrsParams: z.object({
		version: z.number(),
		params: z.array(z.number()),
		optimisedAt: z.number()
	}),
	calibration: z.object({
		secPerAttempt: z.partialRecord(ExerciseKindSchema, z.number()),
		p0: z.partialRecord(MaterialSchema, z.number())
	}),
	lastExportAt: z.number(),
	/** The first-run sample course was decided (added, or skipped): never run again. @see sample-course.ts */
	sampleCourseSeeded: z.literal(true),
	offline: z.object({ persisted: z.boolean(), checkedAt: z.number() }),
	/** The card-path version stored cards were last refreshed to (`CARD_PATHS_VERSION`). @see path-refresh.ts */
	cardPathsVersion: z.number().int().nonnegative(),
	/** Per course, the topics and sections every mode studies; no entry = the whole course. @see scope.ts */
	studyScope: z.record(CourseIdSchema, StudyScopeSchema)
};
export type KvKey = keyof typeof KV_SCHEMAS;
export type KvValue<K extends KvKey> = z.infer<(typeof KV_SCHEMAS)[K]>;
