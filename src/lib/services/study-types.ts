/**
 * The study screen's view of a session, and the exercise types it renders. The UI may not import
 * the engine, so the types it needs are re-exported here.
 *
 * @see BUILD_PLAN §5.1 and §15.1
 */
import type { CardId, CourseColor, EventId, SessionId } from '#lib/db/schemas/common.ts';
import type { SessionPhase } from '#lib/db/schemas/session.ts';
import type { ExerciseResponse, ExerciseVerdict } from '#lib/engine/exercise-check.ts';
import type { ExerciseSpec } from '#lib/engine/exercise-spec.ts';
import type { RoundSummary } from '#lib/engine/round.ts';

export type {
	ChooseManySpec,
	ChooseSpec,
	ExerciseShape,
	ExerciseSpec,
	OrderSpec,
	PairSpec,
	SelfRateSpec,
	SortSpec,
	SpecOption,
	StudySpec,
	TypeSpec
} from '#lib/engine/exercise-spec.ts';
export type { ExerciseResponse, ExerciseVerdict } from '#lib/engine/exercise-check.ts';
export type { RoundSummary } from '#lib/engine/round.ts';
export type { SessionPhase };

/** The card on screen and the exercise built for it. */
export interface StudyItem {
	cardId: CardId;
	exercise: ExerciseSpec;
	/** False during redo-till-right. */
	firstAttempt: boolean;
	phase: SessionPhase;
	dots: { count: number; required: number };
}

/** Everything the study screen shows. `item` and `round` are null once the session ends. */
export interface StudyView {
	sessionId: SessionId;
	course: { id: string; name: string; color: CourseColor };
	phase: SessionPhase;
	ended: boolean;
	item: StudyItem | null;
	round: RoundSummary | null;
	progress: { done: number; total: number };
}

/** The outcome of an answer: the verdict for feedback, and the session after it. */
export interface StudyAnswer {
	verdict: ExerciseVerdict;
	view: StudyView;
	/** The review event logged, for "I was right"; absent for self-rated and pretest answers. */
	reviewEventId?: EventId;
}

export type { ExerciseResponse as StudyResponse };
