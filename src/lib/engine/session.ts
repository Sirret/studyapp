import type { Card } from '#lib/db/schemas/card.ts';
import type { CardId, ExerciseKind, Mode, NoteId } from '#lib/db/schemas/common.ts';
import type { ReviewEvent, StudyEvent } from '#lib/db/schemas/event.ts';
import type { NoteType } from '#lib/db/schemas/note.ts';
import type { SessionCard, SessionPhase, SessionSnapshot } from '#lib/db/schemas/session.ts';
import { CRITERION_LATER, ROUND_WORKING_SET } from '#lib/config/defaults.ts';
import { requiredCorrects } from './criterion.ts';
import { criterionHistory } from './criterion-history.ts';
import { currentKind, groupOf, WORKED_EXAMPLE_KINDS } from './exercise-kinds.ts';
import { compareText, sortEvents } from './replay.ts';
import { byKind, chainConfusables, uniqueById } from './session-order.ts';
import type { Traced } from './trace.ts';

/** A card chosen for a session, with what the caller already worked out about it. */
export interface PlanCard {
	id: CardId;
	noteId: NoteId;
	noteType: NoteType;
	/** The kind it will be shown as (`currentKind`). */
	kind: ExerciseKind;
	/** Never reviewed before. */
	isNew: boolean;
	/** Counting corrects needed this session (`requiredCorrects`). */
	required: number;
	/** No review and no pretest yet: its first answer can make it known on first try. */
	firstEver: boolean;
}

/**
 * Cards in the caller's priority order, the events that log confusions between cards, and the
 * time the session starts (its first round's `startedAt` and `studySince`).
 */
export interface PlanInput {
	cards: readonly PlanCard[];
	confusionEvents: readonly Pick<ReviewEvent, 'cardId' | 'chosenFromCardId'>[];
	now: number;
}

/** What the session knows about its context when it plans a card. @see BUILD_PLAN §6.3 */
export interface PlanContext {
	mode: Mode;
	/** Relearning sessions the plan has for the card before the exam (0 when unknown). */
	relearningSessionsAhead: number;
}

/**
 * Describes a stored card for `planSession`: the kind it shows now (`currentKind` with MC gating),
 * whether it is new (`unseen`), the corrects it needs (`requiredCorrects` from its own events and
 * the context), and whether its next answer would be its first ever with no pretest.
 *
 * @see BUILD_PLAN §5, §6.3 and Decisions log (adaptive first-session criterion)
 */
export function toPlanCard(
	card: Pick<Card, 'id' | 'noteId' | 'path' | 'pathStep' | 'accuracy' | 'status'>,
	noteType: NoteType,
	events: readonly StudyEvent[],
	context: PlanContext
): PlanCard {
	const own = sortEvents(events).filter((event) => 'cardId' in event && event.cardId === card.id);
	const history = criterionHistory(own);
	return {
		id: card.id,
		noteId: card.noteId,
		noteType,
		kind: currentKind(card.path, card.pathStep, card.accuracy),
		isNew: card.status === 'unseen',
		required: requiredCorrects({
			hasMetCriterion: history.metEver,
			knownOnFirstTry: history.knownOnFirstTry,
			mode: context.mode,
			relearningSessionsAhead: context.relearningSessionsAhead
		}),
		firstEver: !history.attempted && !history.pretested
	};
}

/** The order the opening phases run in; cleanup comes once every card is done. */
const OPENING_PHASES: readonly SessionPhase[] = ['warmup', 'new', 'recall', 'discrimination'];

function freshCard(phase: SessionPhase, card: PlanCard): SessionCard {
	return {
		phase,
		required: card.required,
		count: 0,
		lastFull: false,
		failed: false,
		attempt: 0,
		done: false,
		firstEver: card.firstEver
	};
}

/**
 * The phase a card belongs in: warm-up kinds → `warmup`; new cards, `exampleStudy` and `fadeStep`
 * → `new`; Sort & discriminate kinds → `discrimination`; everything else → `recall`.
 *
 * @see BUILD_PLAN §6.4 and Decisions log (session phases)
 */
export function phaseFor(kind: ExerciseKind, isNew: boolean): SessionPhase {
	const group = groupOf(kind);
	if (group === 'warmup') return 'warmup';
	if (isNew || WORKED_EXAMPLE_KINDS.includes(kind)) return 'new';
	return group === 'discriminate' ? 'discrimination' : 'recall';
}

/**
 * Builds the opening snapshot. Cards are ordered by phase (warm-up → new → recall →
 * discrimination), grouped by kind (`PHASE_KIND_ORDER`) within a phase keeping input order, with
 * confusable cards (same compare note, or a logged confusion) adjacent in discrimination. A
 * repeated card ID keeps its first entry. The first `ROUND_WORKING_SET` cards in that order form
 * round 1 (`queue`), started at `now`; the rest wait in `backlog`. `studySince` is `now`.
 *
 * @see BUILD_PLAN §6.4 and Decisions log (session phases, rounds)
 */
export function planSession(input: PlanInput): Traced<SessionSnapshot> {
	const cards = uniqueById(input.cards);
	const phaseOf = new Map(cards.map((card) => [card.id, phaseFor(card.kind, card.isNew)]));
	const ordered = OPENING_PHASES.flatMap((phase) => {
		const inPhase = byKind(cards.filter((card) => phaseOf.get(card.id) === phase));
		return phase === 'discrimination' ? chainConfusables(inPhase, input.confusionEvents) : inPhase;
	});
	const sessionCards: SessionSnapshot['cards'] = {};
	for (const card of ordered)
		sessionCards[card.id] = freshCard(phaseOf.get(card.id) as SessionPhase, card);
	const ids = ordered.map((card) => card.id);
	const queue = ids.slice(0, ROUND_WORKING_SET);
	const trace = OPENING_PHASES.map((phase) => ({
		rule: 'session.phase',
		phase,
		cards: ordered.filter((card) => phaseOf.get(card.id) === phase).map((card) => card.id)
	}));
	const round = { index: 1, startedAt: input.now, answers: 0, cards: queue, ended: false };
	return {
		result: {
			queue,
			backlog: ids.slice(ROUND_WORKING_SET),
			cards: sessionCards,
			clearing: null,
			cleanup: false,
			round,
			studySince: input.now
		},
		trace: [...trace, { rule: 'session.round', index: 1, cards: queue }]
	};
}

/**
 * Starts cleanup once every card is done (round queue and backlog empty): every card that failed
 * this session goes into the backlog once, lowest retrievability first (ties by card ID), needing
 * one more counting correct, with phase `cleanup`. Sets `cleanup`, so it happens once. Returns the
 * state unchanged if cards remain or cleanup already ran.
 *
 * @see CONCEPT §6 and Decisions log (session phases, rounds)
 */
export function startCleanup(
	state: SessionSnapshot,
	retrievability: Readonly<Record<CardId, number>>
): Traced<SessionSnapshot> {
	if (state.queue.length > 0 || state.backlog.length > 0 || state.cleanup) {
		return { result: state, trace: [{ rule: 'session.cleanup', started: false }] };
	}
	const recallOf = (id: CardId) => retrievability[id] ?? 0;
	const failed = (Object.keys(state.cards) as CardId[])
		.filter((id) => state.cards[id]?.failed)
		.sort((a, b) => recallOf(a) - recallOf(b) || compareText(a, b));
	const cards = { ...state.cards };
	for (const id of failed) {
		const card = cards[id] as SessionCard;
		// One more counting correct, the same as a later session's criterion.
		cards[id] = {
			...card,
			phase: 'cleanup',
			required: CRITERION_LATER,
			count: 0,
			lastFull: false,
			done: false
		};
	}
	return {
		result: { ...state, backlog: failed, cards, cleanup: true },
		trace: [{ rule: 'session.cleanup', started: true, cards: failed }]
	};
}

/**
 * The phase of the current card, or of the next card in the backlog between rounds, or `cleanup`
 * when none is left.
 *
 * @see DATA_MODEL §3.7
 */
export function sessionPhase(state: SessionSnapshot): SessionPhase {
	const next = state.queue[0] ?? state.backlog[0];
	return next === undefined ? 'cleanup' : (state.cards[next]?.phase ?? 'cleanup');
}

/** Nothing left: round queue and backlog empty, and cleanup done. @see BUILD_PLAN §6.4 */
export function isSessionComplete(state: SessionSnapshot): boolean {
	return state.queue.length === 0 && state.backlog.length === 0 && state.cleanup;
}
