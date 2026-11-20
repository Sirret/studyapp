import type { Card } from '#lib/db/schemas/card.ts';
import type { ExerciseKind, SessionId } from '#lib/db/schemas/common.ts';
import type { StudyEvent } from '#lib/db/schemas/event.ts';
import type { Settings } from '#lib/db/schemas/kv.ts';
import { confusionCounts } from '#lib/engine/distractors.ts';
import { currentStep } from '#lib/engine/exercise-kinds.ts';
import { buildExercise, exerciseKindFor, type ExerciseSpec } from '#lib/engine/exercise-spec.ts';
import { rngFor } from '#lib/engine/rng.ts';
import type { Traced } from '#lib/engine/trace.ts';
import { isReview, missedTypedIn } from './study-answer.ts';
import { exerciseCourse, type CourseMaterial } from './study-course.ts';

/**
 * The exercise for a card's showing: the forced kind when the plan set one for its first showing,
 * else the kind its path gives (`exerciseKindFor`, first-letter mode after a missed typed answer),
 * built with the seeded rng of `(card, session, attempt)`.
 *
 * @see BUILD_PLAN §5.1, §6.10
 */
export function cardExercise(input: {
	card: Card;
	sessionId: SessionId;
	attempt: number;
	forced: ExerciseKind | undefined;
	events: readonly StudyEvent[];
	settings: Settings;
	material: CourseMaterial;
}): Traced<ExerciseSpec> {
	const { card, sessionId, attempt, events } = input;
	const { path, pathStep, accuracy } = card;
	const kind =
		input.forced ??
		exerciseKindFor({
			path,
			pathStep,
			accuracy,
			spellingMode: input.settings.spellingMode,
			missedTyped: missedTypedIn(events, sessionId, card.id)
		});
	return buildExercise({
		kind,
		card: {
			id: card.id,
			noteId: card.noteId,
			variant: card.variant,
			path,
			step: currentStep(path, pathStep, accuracy)
		},
		course: exerciseCourse(input.material),
		confusions: confusionCounts(events.filter(isReview), card.id),
		rng: rngFor(card.id, sessionId, attempt)
	});
}
