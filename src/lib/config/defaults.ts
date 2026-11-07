/**
 * Every tunable number in the app, in one place.
 *
 * This file is also imported by build tooling (vite, vitest, scripts), so it must not import
 * anything and must stay plain, type-strippable TypeScript.
 *
 * @see BUILD_PLAN §13
 */

/** Full/store name. Never hard-code the name elsewhere. */
export const APP_NAME = 'Snowpack: Study & Cram';
/** PWA short_name, home-screen label and header. */
export const APP_SHORT_NAME = 'Snowpack';
/** One-line description used by the PWA manifest. */
export const APP_DESCRIPTION = 'Offline-first study and cram app for CS and IS students.';
/** Manifest background/theme colour: matches the light `--bg` token (DESIGN §3.1). */
export const PWA_BACKGROUND_COLOR = '#FBF7F0';
/** IndexedDB database name. */
export const DB_NAME = 'snowpack';

/** Target retention for FSRS, default and user range. */
export const RETENTION = 0.9;
export const RETENTION_MIN = 0.8;
export const RETENTION_MAX = 0.95;

/** A study day runs from this local hour to the same hour on the next day. */
export const DAY_ROLLOVER_HOUR = 4;

/** Counting corrects needed in a card's first credited session and in later sessions. */
export const CRITERION_FIRST = 3;
export const CRITERION_LATER = 1;
/** First cut when a plan is infeasible. */
export const CRITERION_FIRST_DEGRADED = 2;
/** First-session criterion when relearning will follow or the card was known on first try. */
export const CRITERION_FIRST_REDUCED = 2;
/** Planned relearning sessions before the exam at which the reduced first criterion applies. */
export const RELEARN_OVERRIDE_SESSIONS = 3;

/** Session rounds: cards in play at once, and the answers or minutes after which a round ends. */
export const ROUND_WORKING_SET = 8;
export const ROUND_MAX_ANSWERS = 40;
export const ROUND_MAX_MINUTES = 8;
/** Minutes of study after which the round summary suggests a break, and its suggested length. */
export const BREAK_SUGGEST_AFTER_MIN = 25;
export const BREAK_MIN = 5;

/** Reinsertion lags (in cards) after a correct answer on a new card. */
export const LAGS = [5, 10, 20] as const;
/** Reinsertion lag (in cards) after an error. */
export const ERROR_LAG = 3;

/** Competitive multiple choice is offered while a card's accuracy is below this. */
export const MC_UNTIL_ACCURACY = 0.75;
export const MC_OPTIONS = 4;
/** Options in first-letter and occlusion word banks. */
export const BANK_SIZE = 4;
/**
 * Typed-answer tolerance: the edits allowed for an answer whose normalised length is at most
 * `upTo` characters, checked in order. @see BUILD_PLAN §6.10
 */
export const FUZZY_EDITS = [
	{ upTo: 4, edits: 0 },
	{ upTo: 8, edits: 1 },
	{ upTo: Number.POSITIVE_INFINITY, edits: 2 }
] as const;
/** First-letter bank options are within this many characters of the answer's length. */
export const FIRST_LETTER_LENGTH_DELTA = 3;

/** FSRS's longest interval, in days (ts-fsrs's default). */
export const FSRS_MAXIMUM_INTERVAL_DAYS = 36500;

export const SECURE_STABILITY_DAYS = 21;
/** Distinct days correct (since the last lapse) for `exam-ready`. @see BUILD_PLAN §6.5 */
export const EXAM_READY_DAYS = 2;
export const SECURE_AT_EXAM = 0.95;
export const FRAGILE_CAP_DAYS = 2;
/** A long-term correct this many study days after the previous review clears cram-fragile. */
export const FRAGILE_SPACED_GAP_DAYS = 1;
/** Shortest interval, in days, left after a massed-mode stability cap. */
export const MIN_CAPPED_INTERVAL_DAYS = 1;

/** Cram spacing: next session gap as a fraction of the days remaining, by exam format. */
export const ALPHA = { recognition: 0.25, mixed: 0.35, recall: 0.42 } as const;
export const NEW_SHARE_MAX = 0.5;
/** K: relearning sessions planned per card. */
export const RELEARN_SESSIONS_MAX = 3;

export const PRETEST_MAX = 3;
export const PRETEST_AUTOHIDE_SKIPS = 2;
export const CHUNK_WORDS = { min: 150, max: 400 } as const;
export const SPLIT_THRESHOLD = 0.75;

export const READ_WPM = 225;
export const SAFETY_MARGIN = 1.2;
export const PRIORITY_WEIGHT = { high: 3, normal: 1 } as const;
export const DAILY_FLOOR_MIN = 10;
export const BLOCK_MIN = 10;
export const ONENIGHT_BREAK_MIN = 10;

/** Attempts needed before measured accuracy replaces the default p0. */
export const CALIBRATION_MIN_ATTEMPTS = 30;
/** Default first-attempt accuracy for new cards, by material type. */
export const P0 = {
	fact: 0.5,
	concept: 0.4,
	procedure: 0.35,
	diagram: 0.45,
	comparison: 0.4
} as const;
/** Default seconds per attempt, by exercise; replaced by the user's rolling median. */
export const SEC_PER_ATTEMPT = {
	mc: 8,
	cloze: 12,
	sequence: 25,
	parsons: 30,
	occlusion: 10,
	structureRebuild: 60,
	categorize: 20,
	scenario: 15,
	tableRow: 25,
	fadeStep: 30,
	newInstance: 120
} as const;

export const FSRS_OPTIMISE_MIN_REVIEWS = 1000;
/** Tesseract word confidence (0–100). */
export const OCR_MIN_CONFIDENCE = 60;
/** Long side of an imported image, in pixels. */
export const IMAGE_MAX_PX = 1600;
/** WebP quality of an imported image, from 0 to 1. */
export const IMAGE_WEBP_QUALITY = 0.8;
/** Exam format of a new course (DATA_MODEL §3.1). */
export const DEFAULT_EXAM_FORMAT = 'mixed';
export const BACKUP_REMINDER_DAYS = 7;

/** Gzipped JavaScript budget for the app shell. */
export const SHELL_JS_BUDGET_KB = 150;
/** Minimum % lines and branches for `src/lib/engine`. */
export const COVERAGE_ENGINE_MIN = 90;
/** Minimum % lines and branches for `src/lib/import`, `transfer` and `db` (BUILD_PLAN §11.1). */
export const COVERAGE_DATA_MIN = 80;
/** App log entries kept on the device. */
export const LOG_RING_SIZE = 2000;
