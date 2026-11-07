import { CRITERION_LATER } from '#lib/config/defaults.ts';
import type { CardId, ExerciseKind, NoteId } from '#lib/db/schemas/common.ts';
import type { Card } from '#lib/db/schemas/card.ts';
import type { ReviewEvent, StudyEvent } from '#lib/db/schemas/event.ts';
import type { NoteType } from '#lib/db/schemas/note.ts';
import type { SessionCard, SessionPhase, SessionSnapshot } from '#lib/db/schemas/session.ts';
import { confusionCounts } from './distractors.ts';
import { hasMetCriterion, requiredCorrects } from './criterion.ts';
import { currentKind, groupOf, PHASE_KIND_ORDER, WORKED_EXAMPLE_KINDS } from './exercise-kinds.ts';
import { compareText, sortEvents } from './replay.ts';
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
}

/** Cards in the caller's priority order, plus the events that log confusions between cards. */
export interface PlanInput {
	cards: readonly PlanCard[];
	confusionEvents: readonly Pick<ReviewEvent, 'cardId' | 'chosenFromCardId'>[];
}

/**
 * Describes a stored card for `planSession`: the kind it shows now (`currentKind` with MC gating),
 * whether it is new (`unseen`), and the corrects it needs from its own events (`requiredCorrects`).
 *
 * @see BUILD_PLAN §5, §6.3 and Decisions log (required corrects)
 */
export function toPlanCard(
	card: Pick<Card, 'id' | 'noteId' | 'path' | 'pathStep' | 'accuracy' | 'status'>,
	noteType: NoteType,
	events: readonly StudyEvent[]
): PlanCard {
	const reviews = sortEvents(events).filter(
		(event): event is ReviewEvent => event.type === 'review' && event.cardId === card.id
	);
	return {
		id: card.id,
		noteId: card.noteId,
		noteType,
		kind: currentKind(card.path, card.pathStep, card.accuracy),
		isNew: card.status === 'unseen',
		required: requiredCorrects(hasMetCriterion(reviews))
	};
}

/** The order the opening phases run in; cleanup is added when the queue empties. */
const OPENING_PHASES: readonly SessionPhase[] = ['warmup', 'new', 'recall', 'discrimination'];

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

function freshCard(phase: SessionPhase, required: number): SessionCard {
	return { phase, required, count: 0, lastFull: false, failed: false, attempt: 0, done: false };
}

function byKind(cards: readonly PlanCard[]): PlanCard[] {
	const rank = (card: PlanCard) => PHASE_KIND_ORDER.indexOf(card.kind);
	return [...cards].sort((a, b) => rank(a) - rank(b));
}

function isSameCompare(a: PlanCard, b: PlanCard): boolean {
	return a.noteType === 'compare' && b.noteType === 'compare' && a.noteId === b.noteId;
}

/** The remaining card most confusable with `last`, or -1 when none is confusable. */
function closestIndex(last: PlanCard, remaining: readonly PlanCard[], input: PlanInput): number {
	const confusions = confusionCounts(input.confusionEvents, last.id);
	let best = -1;
	let bestScore: [number, number] = [0, 0];
	remaining.forEach((card, index) => {
		const score: [number, number] = [
			confusions.get(card.id) ?? 0,
			isSameCompare(last, card) ? 1 : 0
		];
		const better =
			score[0] > bestScore[0] || (score[0] === bestScore[0] && score[1] > bestScore[1]);
		if (better) [best, bestScore] = [index, score];
	});
	return best;
}

/** Chains confusable cards next to each other, otherwise keeping the given order. */
function chainConfusables(cards: readonly PlanCard[], input: PlanInput): PlanCard[] {
	const remaining = [...cards];
	const chained: PlanCard[] = [];
	let last = remaining.shift();
	while (last) {
		chained.push(last);
		const next = closestIndex(last, remaining, input);
		last = next === -1 ? remaining.shift() : remaining.splice(next, 1)[0];
	}
	return chained;
}

function uniqueById(cards: readonly PlanCard[]): PlanCard[] {
	const seen = new Set<CardId>();
	return cards.filter((card) => !seen.has(card.id) && seen.add(card.id));
}

/**
 * Builds the opening snapshot: phases in order warm-up → new → recall → discrimination, cards
 * grouped by kind (`PHASE_KIND_ORDER`) within a phase keeping input order, and confusable cards
 * (same compare note, or a logged confusion) adjacent in discrimination. A repeated card ID keeps
 * its first entry.
 *
 * @see BUILD_PLAN §6.4 and Decisions log (session phases)
 */
export function planSession(input: PlanInput): Traced<SessionSnapshot> {
	const cards = uniqueById(input.cards);
	const phaseOf = new Map(cards.map((card) => [card.id, phaseFor(card.kind, card.isNew)]));
	const ordered = OPENING_PHASES.flatMap((phase) => {
		const inPhase = byKind(cards.filter((card) => phaseOf.get(card.id) === phase));
		return phase === 'discrimination' ? chainConfusables(inPhase, input) : inPhase;
	});
	const sessionCards: SessionSnapshot['cards'] = {};
	for (const card of ordered) {
		sessionCards[card.id] = freshCard(phaseOf.get(card.id) as SessionPhase, card.required);
	}
	const trace = OPENING_PHASES.map((phase) => ({
		rule: 'session.phase',
		phase,
		cards: ordered.filter((card) => phaseOf.get(card.id) === phase).map((card) => card.id)
	}));
	return {
		result: {
			queue: ordered.map((card) => card.id),
			cards: sessionCards,
			clearing: null,
			cleanup: false
		},
		trace
	};
}

/**
 * Starts cleanup once the main queue is empty: every card that failed this session comes back
 * once, lowest retrievability first (ties by card ID), needing one more counting correct. Sets
 * `cleanup`, so it happens once. Returns the state unchanged if the queue isn't empty or cleanup
 * already ran.
 *
 * @see CONCEPT §6 and Decisions log (session phases)
 */
export function startCleanup(
	state: SessionSnapshot,
	retrievability: Readonly<Record<CardId, number>>
): Traced<SessionSnapshot> {
	if (state.queue.length > 0 || state.cleanup) {
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
		result: { ...state, queue: failed, cards, cleanup: true },
		trace: [{ rule: 'session.cleanup', started: true, cards: failed }]
	};
}

/** The phase of the current card, or `cleanup` when the queue is empty. @see DATA_MODEL §3.7 */
export function sessionPhase(state: SessionSnapshot): SessionPhase {
	const head = state.queue[0];
	return head === undefined ? 'cleanup' : (state.cards[head]?.phase ?? 'cleanup');
}

/** Whether the session has nothing left: queue empty and cleanup done. @see BUILD_PLAN §6.4 */
export function isSessionComplete(state: SessionSnapshot): boolean {
	return state.queue.length === 0 && state.cleanup;
}
