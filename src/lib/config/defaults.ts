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
export const PWA_BACKGROUND_COLOR = '#EFE4D0';
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
/** Fewest options a multiple choice shows; with fewer, the card moves to its next path step. */
export const MC_MIN_OPTIONS = 3;
/** Options in first-letter and occlusion word banks. */
export const BANK_SIZE = 4;

/** Exercise content (BUILD_PLAN §5.1). Parsons: extra steps that don't belong. */
export const PARSONS_EXTRAS = 2;
/** Matching: pairs shown, the card's own included. */
export const MATCHING_PAIRS = 4;
/** Multiple-select and odd-one-out: rows of one item used. */
export const ITEM_ROWS_SHOWN = 3;
/** Blurt: characters of a note's text used as its title when it has no name or term. */
export const BLURT_TITLE_CHARS = 60;

/** Cards in a Phase 5 practice session of one course, until the modes (Phase 7) choose them. */
export const PRACTICE_SESSION_CARDS = 20;
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

/** Cram runs when the exam is at most this many days away; further away is long-term. */
export const CRAM_MAX_DAYS = 7;
/** Availability until the student sets it (Phase 8 adds the calendar): minutes every weekday. */
export const DEFAULT_DAY_MINUTES = 60;
export const DEFAULT_SLEEP_WINDOW = { start: '23:00', end: '07:00' } as const;
export const DEFAULT_EXAM_MORNING_MINUTES = 30;
/** Exam start time when a course has a date but no time. */
export const DEFAULT_EXAM_TIME = '09:00';
/** New cards a long-term session feeds in. */
export const LONGTERM_NEW_PER_DAY = 10;
/** Corrects a pre-train or chunk-quiz card needs in its (uncredited) acquisition step. */
export const ACQ_STEP_REQUIRED = 1;

export const PRETEST_MAX = 3;
export const PRETEST_AUTOHIDE_SKIPS = 2;
export const CHUNK_WORDS = { min: 150, max: 400 } as const;
export const SPLIT_THRESHOLD = 0.75;

export const READ_WPM = 225;
export const SAFETY_MARGIN = 1.2;
export const PRIORITY_WEIGHT = { high: 3, normal: 1 } as const;
export const DAILY_FLOOR_MIN = 10;
export const BLOCK_MIN = 10;
/** Days the Plan screen shows from today (more when an exam is further out). @see BUILD_PLAN §6.9 */
export const PLAN_FORECAST_DAYS = 7;
export const ONENIGHT_BREAK_MIN = 10;
/** One-night always plans at least this block, even past the sleep start (with the sleep reminder). */
export const ONENIGHT_MIN_BLOCK_MIN = 45;
/** Longest gap between two answers of a session that counts as study time (today's minutes used). */
export const IDLE_CAP_SEC = 60;

/** Attempts needed before measured accuracy replaces the default p0. */
export const CALIBRATION_MIN_ATTEMPTS = 30;
/** Accuracy of a new card after its first attempt, and of its relearning while it has no FSRS state. */
export const P_LEARNED = 0.8;
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
/** Seconds per attempt for a kind with no `SEC_PER_ATTEMPT` entry and no calibration. */
export const SEC_PER_ATTEMPT_DEFAULT = 15;

export const FSRS_OPTIMISE_MIN_REVIEWS = 1000;
/** Tesseract word confidence (0–100). */
export const OCR_MIN_CONFIDENCE = 60;
/** Long side of an imported image, in pixels (Decisions log "Phase 6 Q6–Q7"). */
export const IMAGE_MAX_PX = 2000;
/** WebP quality of an imported image, from 0 to 1. */
export const IMAGE_WEBP_QUALITY = 0.8;
/** JPEG quality where the browser can't write WebP (Safari), from 0 to 1. */
export const IMAGE_JPEG_QUALITY = 0.85;
/** Exam format of a new course (DATA_MODEL §3.1). */
export const DEFAULT_EXAM_FORMAT = 'mixed';
export const BACKUP_REMINDER_DAYS = 7;

/** Haptic tick on a first-attempt correct, in ms (DESIGN §11.2). */
export const HAPTIC_TICK_MS = 12;
/** First-attempt corrects in a row that bring a snow flurry and Yuki's sparkle (DESIGN §7.3, §11.2). */
export const STREAK_FOR_FLURRY = 3;

/** How long a phase interstitial stays before it leaves by itself (DESIGN §7.3). */
export const PHASE_INTERSTITIAL_MS = 1200;

/** Auto-night theme: hours before the sleep window starts that the dark theme begins (DESIGN §3.1). */
export const AUTO_NIGHT_LEAD_HOURS = 2;

/** Gzipped JavaScript budget for the app shell. */
export const SHELL_JS_BUDGET_KB = 150;
/** Minimum % lines and branches for `src/lib/engine`. */
export const COVERAGE_ENGINE_MIN = 90;
/** Minimum % lines and branches for `src/lib/import`, `transfer` and `db` (BUILD_PLAN §11.1). */
export const COVERAGE_DATA_MIN = 80;
/** App log entries kept on the device. */
export const LOG_RING_SIZE = 2000;
/** The goal the import screen starts with, until the student picks another (PROMPTS.md intake). */
export const DEFAULT_IMPORT_GOAL = 'learn';

// Phase 8.6 — Learn & Practice (SESSION_NOTES §C, §D, §J; Decisions log "Phase 8.6 Qn").
/** Questions after a section in Learn; 1 when the section has at most this many cards (Q7). */
export const LEARN_SECTION_QUESTIONS = 2;
/** A look-back comes from a section at least this many sections back in Learn order (Q8). */
export const LOOKBACK_MIN_DISTANCE = 2;
/** Learn and Practice rounds pause after this many answered cards; no clock (Q16). */
export const LEARN_ROUND_CARDS = 20;
/** Term cards on the Meet the terms screen (Q6). */
export const MEET_TERMS_MAX = 4;
/** Fewer terms than this and Meet the terms is skipped (Q6). */
export const MEET_TERMS_MIN = 2;
/** "Name N of M": N = ceil(M × this), at least `LIST_N_MIN` (Q9). */
export const LIST_N_SHARE = 0.5;
export const LIST_N_MIN = 2;
/** Lists of at most this many items are only asked whole (`listAll`) (Q9). */
export const LIST_ALL_ONLY_MAX = 3;
/** Micro hint: words shown for lists and multi-word answers (Q10; DESIGN §7 Flashcard). */
export const HINT_WORDS = 3;
/** Micro hint: letters shown per word of a typed answer (Q10). */
export const HINT_LETTERS = 2;
/** Bump when `generateCards` paths change, so stored cards are refreshed once (path-refresh.ts). 1 = Phase 8.6 list and key-word paths. */
export const CARD_PATHS_VERSION = 1;
/** Sound effects: master volume (0–1), kept low (SESSION_NOTES §D7; Q11). */
export const SOUND_VOLUME = 0.3;
/** Sound effects: fade-in time of every tone, seconds (avoids clicks). */
export const SOUND_ATTACK_S = 0.005;
/** Sound effects: one effect's tones. `noise` is a band-passed noise burst centred on `freq`. */
export interface SoundTone {
	wave: 'sine' | 'triangle' | 'noise';
	/** Start frequency (Hz); for noise, the band's centre. */
	freq: number;
	/** Glide to this frequency over the tone (Hz); absent = steady. */
	endFreq?: number;
	/** Offset from the effect's start, seconds. */
	at: number;
	/** Length, seconds. */
	duration: number;
	/** Peak level before the master volume (0–1). */
	gain: number;
}
/** The four effects (SESSION_NOTES §D7): paw tap, snow crunch (correct), low note (wrong), stamp (exam-ready). */
export const SOUND_EFFECTS = {
	pawTap: [{ wave: 'sine', freq: 240, endFreq: 120, at: 0, duration: 0.07, gain: 0.5 }],
	crunch: [
		{ wave: 'noise', freq: 2600, at: 0, duration: 0.06, gain: 0.5 },
		{ wave: 'noise', freq: 3400, at: 0.05, duration: 0.08, gain: 0.4 }
	],
	lowNote: [{ wave: 'triangle', freq: 196, endFreq: 175, at: 0, duration: 0.28, gain: 0.45 }],
	stamp: [
		{ wave: 'sine', freq: 160, endFreq: 55, at: 0, duration: 0.14, gain: 0.8 },
		{ wave: 'noise', freq: 900, at: 0, duration: 0.04, gain: 0.35 }
	]
} as const satisfies Record<string, readonly SoundTone[]>;

// Phase 6 — Diagrams (BUILD_PLAN §7; Decisions log "Phase 6 …").
/** Fewest options an occlusion word bank shows (the answer + 1); fewer boxes → `occlusionType`. Options come only from the same image's boxes. */
export const OCCLUSION_BANK_MIN_OPTIONS = 2;
/** A box placed by a tap (or from an `unplaced` label), as fractions of the image's width and height. */
export const OCCLUSION_NEW_BOX = { w: 0.16, h: 0.07 } as const;
/** Smallest box side, as a fraction of the image side. */
export const OCCLUSION_MIN_BOX = 0.02;
/** One press of a move or resize button in the occlusion editor, as a fraction of the image side. */
export const OCCLUSION_NUDGE = 0.01;
/** Largest diagram drawn; bigger ones show "too big to draw, edit as text" (Decisions log "Phase 6 Q4"). */
export const DIAGRAM_MAX_NODES = 24;
export const DIAGRAM_MAX_EDGES = 40;
/** Node box size in layout units (1 unit = 1 CSS px at scale 1): width grows with the label. */
export const DIAGRAM_NODE = { minWidth: 96, maxWidth: 220, charWidth: 9, height: 44 } as const;
/** Gaps between nodes in one layer (x) and between layers (y), in layout units. */
export const DIAGRAM_GAP = { x: 32, y: 56 } as const;
/** Down-and-up barycentre passes when ordering a flow's layers to reduce crossings. */
export const DIAGRAM_LAYOUT_SWEEPS = 4;
/** Space between a stack's rows, in layout units (a stack reads as one column of layers). */
export const DIAGRAM_STACK_GAP = 8;
