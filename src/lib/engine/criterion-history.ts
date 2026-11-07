import { CRITERION_FIRST_REDUCED } from '#lib/config/defaults.ts';
import type { ReviewEvent, StudyEvent } from '#lib/db/schemas/event.ts';
import {
	isCounting,
	isCriterionMet,
	requiredCorrects,
	startCriterion,
	stepCriterion,
	type CriterionState
} from './criterion.ts';

/** One session's criterion progress inside a card's history. */
export interface SessionCriterion {
	criterion: CriterionState;
	/** The criterion was met at some point in this session. */
	met: boolean;
	/** The card had met its criterion before this session started (a relearning session). */
	relearn: boolean;
}

/** What one card's events say about its criterion, folded in replay order. */
export interface CriterionHistory {
	/** The card has met its criterion in some credited session. */
	metEver: boolean;
	/** The card has had a review event. */
	attempted: boolean;
	/** The card had a pretest before its first review event. */
	pretested: boolean;
	/** Its first review event was a correct `full` or `recognition` answer, with no pretest before. */
	knownOnFirstTry: boolean;
	sessions: Map<string, SessionCriterion>;
}

/** A card with no events. */
export function emptyCriterionHistory(): CriterionHistory {
	return {
		metEver: false,
		attempted: false,
		pretested: false,
		knownOnFirstTry: false,
		sessions: new Map()
	};
}

/**
 * Folds one of the card's events into its history (mutating it). Pretests and first review
 * events update the known-on-first-try facts. A counting event joins its session: a session's
 * `required` starts as the event's `required`, or else `requiredCorrects` of the history so far
 * (no planned relearning count is known here); it follows the `required` of each later event, and
 * without one drops to `CRITERION_FIRST_REDUCED` right after a first-ever correct. Returns the
 * session for a counting event, else null.
 *
 * @see BUILD_PLAN §6.3 and Decisions log (adaptive first-session criterion, review `required`)
 */
export function recordCriterion(
	history: CriterionHistory,
	event: StudyEvent
): { session: SessionCriterion; isFirstOfSession: boolean } | null {
	if (event.type === 'pretest') {
		if (!history.attempted) history.pretested = true;
		return null;
	}
	if (event.type !== 'review') return null;
	const justKnown = noteFirstReview(history, event);
	if (!isCounting(event)) return null;
	const { session, isFirstOfSession } = sessionFor(history, event);
	let criterion = stepCriterion(session.criterion, event);
	if (event.required !== undefined) criterion = { ...criterion, required: event.required };
	else if (justKnown) {
		criterion = { ...criterion, required: Math.min(criterion.required, CRITERION_FIRST_REDUCED) };
	}
	session.criterion = criterion;
	session.met ||= isCriterionMet(criterion);
	history.metEver ||= session.met;
	return { session, isFirstOfSession };
}

/** Records the card's first review event; true when it makes the card known on first try. */
function noteFirstReview(history: CriterionHistory, event: ReviewEvent): boolean {
	if (history.attempted) return false;
	history.attempted = true;
	history.knownOnFirstTry = event.correct && event.weight !== 'none' && !history.pretested;
	return history.knownOnFirstTry;
}

/** The event's session, created with its starting `required` at its first counting event. */
function sessionFor(
	history: CriterionHistory,
	event: ReviewEvent
): { session: SessionCriterion; isFirstOfSession: boolean } {
	const existing = history.sessions.get(event.sessionId);
	if (existing) return { session: existing, isFirstOfSession: false };
	const required =
		event.required ??
		requiredCorrects({
			hasMetCriterion: history.metEver,
			knownOnFirstTry: history.knownOnFirstTry,
			mode: event.mode,
			relearningSessionsAhead: 0
		});
	const session = { criterion: startCriterion(required), met: false, relearn: history.metEver };
	history.sessions.set(event.sessionId, session);
	return { session, isFirstOfSession: true };
}

/**
 * Whether a card has met its criterion in some credited session, from its events in replay
 * order, counted exactly as replay counts them (`recordCriterion`).
 *
 * @see BUILD_PLAN §6.3
 */
export function hasMetCriterion(events: readonly StudyEvent[]): boolean {
	return criterionHistory(events).metEver;
}

/** Folds all of a card's events (already in replay order) into a history. @see BUILD_PLAN §6.3 */
export function criterionHistory(events: readonly StudyEvent[]): CriterionHistory {
	const history = emptyCriterionHistory();
	for (const event of events) recordCriterion(history, event);
	return history;
}
