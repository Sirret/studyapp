import {
	CRITERION_LATER,
	FRAGILE_CAP_DAYS,
	FRAGILE_SPACED_GAP_DAYS
} from '#lib/config/defaults.ts';
import type { CardCaches, FsrsCardState } from '#lib/db/schemas/card.ts';
import type { ExerciseKind, Mode, SessionId } from '#lib/db/schemas/common.ts';
import type { ReviewEvent, StudyEvent } from '#lib/db/schemas/event.ts';
import {
	isCounting,
	isCriterionMet,
	requiredCorrects,
	startCriterion,
	stepCriterion,
	type CriterionState
} from './criterion.ts';
import { advancePathStep } from './exercise-kinds.ts';
import { capStability, ratingFor, reviewFsrs, type FsrsConfig } from './fsrs.ts';
import { deriveStatus, EMPTY_DAY_TALLY, tallyDay, type DayTally } from './status.ts';
import { dayIndex, daysBetween } from './time.ts';
import type { Traced, TraceEntry } from './trace.ts';

/** Modes whose study is massed: their corrects grant only capped, fragile stability. */
const MASSED_MODES: ReadonlySet<Mode> = new Set(['cram', 'onenight']);

interface SessionFold {
	mode: Mode;
	criterion: CriterionState;
	met: boolean;
}

/** Everything replay tracks for one card while folding its events. */
interface CardFold {
	fsrs: FsrsCardState | null;
	fragile: boolean;
	pathStep: number;
	accuracy: CardCaches['accuracy'];
	tally: DayTally;
	reviewed: boolean;
	counted: boolean;
	onlyOneNight: boolean;
	lastCorrect: boolean;
	metEver: boolean;
	sessions: Map<SessionId, SessionFold>;
	lastSession: SessionFold | null;
	trace: TraceEntry[];
}

function emptyFold(): CardFold {
	return {
		fsrs: null,
		fragile: false,
		pathStep: 0,
		accuracy: { n: 0, correct: 0 },
		tally: EMPTY_DAY_TALLY,
		reviewed: false,
		counted: false,
		onlyOneNight: true,
		lastCorrect: false,
		metEver: false,
		sessions: new Map(),
		lastSession: null,
		trace: []
	};
}

/** What replay needs of a card and the settings it folds with. */
export interface ReplayCardInput {
	path: readonly ExerciseKind[];
	fsrs: FsrsConfig;
	tzOffsetMin: number;
}

/** Whether a long-term correct survived a genuine spaced interval since the previous review. */
function survivedSpacedGap(
	previous: FsrsCardState | null,
	event: ReviewEvent,
	tzOffsetMin: number
): boolean {
	if (event.mode !== 'longterm' || !event.correct || previous?.last_review === undefined)
		return false;
	return daysBetween(previous.last_review, event.ts, tzOffsetMin) >= FRAGILE_SPACED_GAP_DAYS;
}

/** Applies the session's FSRS review, with the massed-mode cap and the fragile rules. */
function applyFsrs(fold: CardFold, event: ReviewEvent, input: ReplayCardInput): void {
	const rating = ratingFor(event.weight, event.correct) ?? 'again';
	const previous = fold.fsrs;
	let next = reviewFsrs(previous, event.ts, rating, input.fsrs).result;
	if (MASSED_MODES.has(event.mode) && event.correct) {
		next = capStability(next, Math.max(previous?.stability ?? 0, FRAGILE_CAP_DAYS));
		fold.fragile ||= next.stability <= FRAGILE_CAP_DAYS;
	} else if (survivedSpacedGap(previous, event, input.tzOffsetMin)) {
		fold.fragile = false;
	}
	fold.fsrs = next;
	fold.trace.push({
		rule: 'replay.fsrs',
		cardId: event.cardId,
		sessionId: event.sessionId,
		rating,
		stability: next.stability,
		fragile: fold.fragile
	});
}

/** A counting event: criterion, the session's first FSRS review, study days and status facts. */
function foldCounting(fold: CardFold, event: ReviewEvent, input: ReplayCardInput): void {
	let session = fold.sessions.get(event.sessionId);
	const isFsrsReview = session === undefined;
	if (!session) {
		session = {
			mode: event.mode,
			criterion: startCriterion(requiredCorrects(fold.metEver)),
			met: false
		};
		fold.sessions.set(event.sessionId, session);
	}
	session.criterion = stepCriterion(session.criterion, event);
	session.met ||= isCriterionMet(session.criterion);
	fold.metEver ||= session.met;
	if (isFsrsReview) applyFsrs(fold, event, input);
	fold.tally = tallyDay(fold.tally, {
		day: dayIndex(event.ts, input.tzOffsetMin),
		correct: event.correct
	});
	fold.counted = true;
	fold.onlyOneNight &&= event.mode === 'onenight';
	fold.lastCorrect = event.correct;
	fold.lastSession = session;
}

function foldReview(fold: CardFold, event: ReviewEvent, input: ReplayCardInput): void {
	fold.reviewed = true;
	if (event.firstAttempt && event.weight !== 'none') {
		const { n, correct } = fold.accuracy;
		fold.accuracy = { n: n + 1, correct: correct + (event.correct ? 1 : 0) };
	}
	if (event.firstAttempt && (event.correct || event.weight === 'none')) {
		fold.pathStep = advancePathStep(input.path, fold.pathStep, event.kind);
	}
	if (isCounting(event)) foldCounting(fold, event, input);
}

function foldEvent(fold: CardFold, event: StudyEvent, input: ReplayCardInput): void {
	if (event.type === 'review') foldReview(fold, event, input);
	else if (event.type === 'selfRated') {
		fold.pathStep = advancePathStep(input.path, fold.pathStep, event.kind);
	}
}

function cachesOf(fold: CardFold): Traced<CardCaches> {
	const last = fold.lastSession;
	const status = deriveStatus({
		reviewed: fold.reviewed,
		counted: fold.counted,
		onlyOneNight: fold.onlyOneNight,
		daysCorrect: fold.tally.countedDays.length,
		lastCorrect: fold.lastCorrect,
		stability: fold.fsrs?.stability ?? null,
		fragile: fold.fragile,
		cramCriterionMet: last?.mode === 'cram' && last.met
	});
	const caches: CardCaches = {
		fsrs: fold.fsrs,
		...(fold.fsrs ? { due: fold.fsrs.due } : {}),
		status: status.result,
		fragile: fold.fragile,
		weak: last !== null && last.criterion.required === CRITERION_LATER && last.criterion.failed,
		daysCorrect: fold.tally.countedDays.length,
		pathStep: fold.pathStep,
		accuracy: fold.accuracy
	};
	return { result: caches, trace: [...fold.trace, ...status.trace] };
}

/**
 * Folds one card's events, already in replay order and all for this card, into its caches.
 * Review events drive accuracy, `pathStep`, the criterion, the session's FSRS review (its first
 * counting event), fragile, study days and status; self-rated events can move `pathStep`.
 *
 * @see BUILD_PLAN §6.2, §6.3, §6.5, §6.12 and Decisions log (Phase 4 rows)
 */
export function replayCard(
	events: readonly StudyEvent[],
	input: ReplayCardInput
): Traced<CardCaches> {
	const fold = emptyFold();
	for (const event of events) foldEvent(fold, event, input);
	return cachesOf(fold);
}
