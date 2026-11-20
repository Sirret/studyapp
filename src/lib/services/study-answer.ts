import type { CardId, ExerciseKind, Mode, SessionId } from '#lib/db/schemas/common.ts';
import type { ReviewEvent, StudyEvent } from '#lib/db/schemas/event.ts';
import type { ExerciseResponse, ExerciseVerdict } from '#lib/engine/exercise-check.ts';
import type { ExerciseSpec } from '#lib/engine/exercise-spec.ts';
import type { AnswerInput, SelfRatedInput } from './session-service.ts';

/** Kinds answered by typing, after which the next showing uses first-letter mode (§6.10). */
const TYPED_KINDS: ReadonlySet<ExerciseKind> = new Set([
	'cloze',
	'firstLetterType',
	'fadeStep',
	'newInstance'
]);

export const isReview = (event: StudyEvent): event is ReviewEvent => event.type === 'review';

/**
 * Whether answers in this mode earn scheduling credit: same-day acquisition (Learn and Exam prep's
 * learn steps) and Practice answers don't.
 *
 * @see BUILD_PLAN §6.7; Decisions log "Phase 8.6 Q3", "Q4"
 */
export function creditedIn(mode: Mode | undefined): boolean {
	return mode !== 'acquisition' && mode !== 'practice';
}

/** The card's previous review in this session was a wrong typed answer (§6.10 first-letter mode). */
export function missedTypedIn(
	events: readonly StudyEvent[],
	sessionId: SessionId,
	cardId: CardId
): boolean {
	const last = events
		.filter(isReview)
		.filter((event) => event.sessionId === sessionId && event.cardId === cardId)
		.sort((a, b) => b.seq - a.seq)[0];
	return last !== undefined && !last.correct && TYPED_KINDS.has(last.kind);
}

/** The self-rated fields an answer logs: ticked items, missed cards (blurt) and the rating. */
export function selfRatedOf(
	spec: ExerciseSpec,
	response: ExerciseResponse
): { selfRated?: SelfRatedInput } {
	if (spec.shape !== 'selfRate' || response.shape !== 'selfRate') return {};
	const ticked = new Set(response.checked);
	const checked = spec.checklist.filter((_item, i) => ticked.has(i)).map((item) => item.text);
	const missed = spec.checklist.flatMap((item, i) =>
		!ticked.has(i) && item.cardId ? [item.cardId] : []
	);
	return {
		selfRated: {
			...(spec.kind === 'flip' && response.rating ? { rating: response.rating } : {}),
			...(spec.checklist.length > 0 ? { checked } : {}),
			...(spec.kind === 'blurt' ? { missedCardIds: missed } : {})
		}
	};
}

/** The exercise on screen: when it was shown, its attempt (for the hint's rng) and whether a hint was used. */
export interface Shown {
	spec: ExerciseSpec;
	at: number;
	attempt: number;
	hinted: boolean;
}

/**
 * What an answer logs from its verdict: the verdict's weight when it differs from the kind's (an
 * idea unit ticked by the student), how it was graded (`fuzzy` for a typo match), and the hint.
 *
 * @see DATA_MODEL §3.6 (`weight`, `verdictKind`, `hinted`); Decisions log "Phase 8.6 Q1", "Q10"
 */
export function answerOf(
	shown: Shown,
	verdict: ExerciseVerdict,
	now: number
): Omit<AnswerInput, 'credited'> {
	const verdictKind =
		verdict.verdictKind ?? (verdict.correct && verdict.typo ? 'fuzzy' : undefined);
	return {
		kind: shown.spec.kind,
		correct: verdict.correct,
		responseMs: now - shown.at,
		...(verdict.weight ? { weight: verdict.weight } : {}),
		...(verdictKind ? { verdictKind } : {}),
		...(shown.hinted ? { hinted: true } : {}),
		...(verdict.chosen === undefined ? {} : { chosen: verdict.chosen }),
		...(verdict.chosenFromCardId ? { chosenFromCardId: verdict.chosenFromCardId } : {})
	};
}
