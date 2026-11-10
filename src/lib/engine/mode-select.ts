import { CRAM_MAX_DAYS, LONGTERM_NEW_PER_DAY } from '#lib/config/defaults.ts';
import type { Card } from '#lib/db/schemas/card.ts';
import type { CardId, Mode } from '#lib/db/schemas/common.ts';
import { compareText } from './replay.ts';
import type { Traced } from './trace.ts';

/**
 * Which modes a course runs today, and the cards of a long-term session.
 *
 * @see BUILD_PLAN §6.6–§6.8, CONCEPT §7–§9 and Decisions log (Phase 7: mode choice)
 */

/** Today's modes for a course: how read material is reviewed, and how unread material is learnt. */
export interface TodayModes {
	review: Extract<Mode, 'longterm' | 'cram'>;
	/** `null` when nothing is unread. */
	learn: Extract<Mode, 'acquisition' | 'onenight'> | null;
	/** Study days to the exam (0 = exam day), or `null` with no exam ahead. */
	daysToExam: number | null;
}

/**
 * No exam, an exam already past, or one more than `CRAM_MAX_DAYS` days away → long-term; 0 to
 * `CRAM_MAX_DAYS` days → cram (handback after the exam day). Unread material: one-night when the
 * exam is tomorrow (1 day), else acquisition.
 */
export function todayModes(input: {
	today: number;
	examDay: number | null;
	hasUnread: boolean;
}): Traced<TodayModes> {
	const ahead = input.examDay === null ? null : input.examDay - input.today;
	const daysToExam = ahead !== null && ahead >= 0 ? ahead : null;
	const review = daysToExam !== null && daysToExam <= CRAM_MAX_DAYS ? 'cram' : 'longterm';
	const learn = !input.hasUnread ? null : daysToExam === 1 ? 'onenight' : 'acquisition';
	const result: TodayModes = { review, learn, daysToExam };
	return { result, trace: [{ rule: 'mode.today', ...result }] };
}

/**
 * A long-term session: due cards (`due ≤ now`, status not `unseen`), earliest due first, ties by
 * ID; then up to `LONGTERM_NEW_PER_DAY` unseen cards from `newCandidates`, in the order given.
 * Suspended cards never.
 */
export function longtermCards(input: {
	cards: readonly Pick<Card, 'id' | 'due' | 'status' | 'suspended'>[];
	newCandidates: readonly CardId[];
	now: number;
}): Traced<CardId[]> {
	const live = input.cards.filter((card) => !card.suspended);
	const due = live
		.filter((card) => card.status !== 'unseen' && card.due !== undefined && card.due <= input.now)
		.sort((a, b) => (a.due ?? 0) - (b.due ?? 0) || compareText(a.id, b.id))
		.map((card) => card.id);
	const unseen = new Set(live.filter((card) => card.status === 'unseen').map((card) => card.id));
	const fresh = input.newCandidates.filter((id) => unseen.has(id)).slice(0, LONGTERM_NEW_PER_DAY);
	return {
		result: [...due, ...fresh],
		trace: [{ rule: 'mode.longterm', due: due.length, new: fresh.length }]
	};
}
