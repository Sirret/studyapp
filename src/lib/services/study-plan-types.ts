import type { CardId, ExerciseKind, Mode } from '#lib/db/schemas/common.ts';
import type { RoundBy } from '#lib/db/schemas/session.ts';

/**
 * Options for a practice session, for the dev e2e harness only: `cardIds` picks the cards (in this
 * order, no cap) and `forceKinds` sets the kind of a card's first showing; later showings follow its
 * path, so a card forced to a recognition kind can still meet the criterion.
 */
export interface StartOptions {
	cardIds?: readonly CardId[];
	forceKinds?: Partial<Record<CardId, ExerciseKind>>;
}

/** One card of a planned session: its kind on first showing and its criterion, when the mode sets them. */
export interface PlannedCard {
	id: CardId;
	kind?: ExerciseKind;
	required?: number;
	/** Relearning sessions the plan has for the card before the exam. */
	relearningSessionsAhead?: number;
}

/**
 * A session a mode has planned. Acquisition and practice answers are logged with
 * `credited: false`. `roundBy: 'count'` (Learn, Practice) pauses after `LEARN_ROUND_CARDS`
 * answers instead of by the clock.
 *
 * @see BUILD_PLAN §6.4; Decisions log "Phase 8.6 Q3", "Q4", "Q16"
 */
export interface PlannedSession {
	mode: Mode;
	cards: readonly PlannedCard[];
	plannedMinutes: number;
	roundBy?: RoundBy;
}
