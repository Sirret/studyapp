import {
	BREAK_MIN,
	BREAK_SUGGEST_AFTER_MIN,
	ROUND_MAX_ANSWERS,
	ROUND_MAX_MINUTES,
	ROUND_WORKING_SET
} from '#lib/config/defaults.ts';
import type { SessionSnapshot } from '#lib/db/schemas/session.ts';
import { MS_PER_MINUTE } from './time.ts';
import type { Traced } from './trace.ts';

type EndReason = 'all-done' | 'answers' | 'minutes';

function endReason(state: SessionSnapshot, now: number): EndReason | null {
	const { round } = state;
	if (state.queue.length === 0) return 'all-done';
	if (round.answers >= ROUND_MAX_ANSWERS) return 'answers';
	return now - round.startedAt >= ROUND_MAX_MINUTES * MS_PER_MINUTE ? 'minutes' : null;
}

/** What the round summary shows between rounds. @see BUILD_PLAN §6.4, DESIGN §5 (RoundSummary) */
export interface RoundSummary {
	/** The round that just ended (1-based). */
	index: number;
	/** Cards from this round that met their criterion. */
	finished: number;
	/** Unfinished cards that carry over to the next round. */
	carried: number;
	/** Cards still to come: carried over plus not yet in play. */
	remaining: number;
	/** At least `BREAK_SUGGEST_AFTER_MIN` minutes since `studySince`: suggest a break. */
	suggestBreak: boolean;
	/** The suggested break length, `BREAK_MIN`. */
	breakMinutes: number;
}

/**
 * Ends the round when all its cards are done, or after `ROUND_MAX_ANSWERS` answers or
 * `ROUND_MAX_MINUTES` minutes since it started, but never while a card is mid-redo (`clearing`).
 * Returns the state unchanged otherwise, or if the round already ended.
 *
 * @see BUILD_PLAN §6.4 (rounds)
 */
export function checkRoundEnd(state: SessionSnapshot, now: number): Traced<SessionSnapshot> {
	const reason = state.round.ended || state.clearing !== null ? null : endReason(state, now);
	if (reason === null) return { result: state, trace: [{ rule: 'round.continue' }] };
	return {
		result: { ...state, round: { ...state.round, ended: true } },
		trace: [{ rule: 'round.end', index: state.round.index, reason }]
	};
}

/**
 * Opens the next round after one ended: unfinished cards first in their order, then cards from
 * the backlog in plan order, up to `ROUND_WORKING_SET`. After a break, `studySince` restarts at
 * `now`. Returns the state unchanged if the round hasn't ended or no cards are left.
 *
 * @see BUILD_PLAN §6.4 (rounds)
 */
export function startRound(
	state: SessionSnapshot,
	now: number,
	options: { afterBreak: boolean }
): Traced<SessionSnapshot> {
	const carried = state.queue;
	const fill = state.backlog.slice(0, Math.max(ROUND_WORKING_SET - carried.length, 0));
	const queue = [...carried, ...fill];
	if (!state.round.ended || queue.length === 0) {
		return { result: state, trace: [{ rule: 'round.start', started: false }] };
	}
	const index = state.round.index + 1;
	return {
		result: {
			...state,
			queue,
			backlog: state.backlog.slice(fill.length),
			round: { index, startedAt: now, answers: 0, cards: queue, ended: false },
			studySince: options.afterBreak ? now : state.studySince
		},
		trace: [{ rule: 'round.start', started: true, index, carried: carried.length, cards: queue }]
	};
}

/** The summary for the round that just ended. @see BUILD_PLAN §6.4, DESIGN §5 */
export function roundSummary(state: SessionSnapshot, now: number): RoundSummary {
	const carried = state.queue.length;
	return {
		index: state.round.index,
		finished: state.round.cards.filter((id) => !state.queue.includes(id)).length,
		carried,
		remaining: carried + state.backlog.length,
		suggestBreak: now - state.studySince >= BREAK_SUGGEST_AFTER_MIN * MS_PER_MINUTE,
		breakMinutes: BREAK_MIN
	};
}
