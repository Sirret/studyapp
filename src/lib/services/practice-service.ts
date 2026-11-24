import type { CardRepo, CourseRepo, NoteRepo, TopicRepo } from '#lib/db/repos/content-repos.ts';
import type { EventRepo } from '#lib/db/repos/event-repo.ts';
import type { KvRepo } from '#lib/db/repos/kv-repo.ts';
import type { Card } from '#lib/db/schemas/card.ts';
import type { CardId, CourseId, ExerciseKind, SessionId } from '#lib/db/schemas/common.ts';
import { currentStep } from '#lib/engine/exercise-kinds.ts';
import { buildExercise, type ExerciseSpec } from '#lib/engine/exercise-spec.ts';
import { missesToRetry, nextDeckPass, quickQuiz } from '#lib/engine/practice.ts';
import { rngFor } from '#lib/engine/rng.ts';
import { scopeItems } from '#lib/engine/scope.ts';
import type { Logger } from '#lib/log/logger.ts';
import { courseScope } from './course-scope.ts';
import { isReview } from './study-answer.ts';
import { exerciseCourse, isStudyable, loadCourse, type CourseMaterial } from './study-course.ts';
import type { StudyService } from './study-service.ts';
import type { StudyView } from './study-types.ts';

export interface PracticeServiceDeps {
	study: StudyService;
	repos: { courses: CourseRepo; topics: TopicRepo; notes: NoteRepo; cards: CardRepo };
	events: EventRepo;
	kv: KvRepo;
	logger: Logger;
}

/** One flashcard of the deck: its card and the flip exercise (front, back) built for it. */
export interface DeckCard {
	cardId: CardId;
	exercise: ExerciseSpec;
}

/** The quick quiz's end summary. */
export interface QuizSummary {
	asked: number;
	/** Cards right on their first showing. */
	right: number;
	/** Cards answered wrong at least once, in the order first missed. */
	missed: CardId[];
}

/** The seed name of the deck's rng: the deck is not a session, so it has its own fixed name. */
const DECK_SEED = 'practice-deck';

/**
 * Practice: a flashcard deck (flip, Still learning / Know it, never logged) and a quick quiz over
 * the in-scope cards (mode `practice`, `credited: false`, count rounds, one correct per card;
 * replay skips these events, so FSRS state never changes). A missed card comes back through the
 * queue's redo-till-right and later re-ask; the end summary lists the misses.
 *
 * @see SESSION_NOTES §C, J; Decisions log "Phase 8.6 Q4", "Q16", "Q18"
 */
export class PracticeService {
	constructor(private readonly deps: PracticeServiceDeps) {}

	/**
	 * The deck: every in-scope card, in course order, as a flip exercise. A figure card (diagram or
	 * picture) shows its own figure exercise's picture and question on the front.
	 */
	async deck(courseId: CourseId): Promise<DeckCard[]> {
		const { material, cards } = await this.cards(courseId);
		const course = exerciseCourse(material);
		return cards.map((card) => {
			const step = currentStep(card.path, card.pathStep, card.accuracy);
			const build = (kind: ExerciseKind) =>
				buildExercise({
					kind,
					card: { id: card.id, noteId: card.noteId, variant: card.variant, path: card.path, step },
					course,
					confusions: new Map(),
					rng: rngFor(card.id, DECK_SEED, 0)
				}).result;
			const flip = build('flip');
			const type = material.notes.get(card.noteId)?.type;
			if (flip.shape !== 'selfRate' || (type !== 'diagram' && type !== 'occlusion')) {
				return { cardId: card.id, exercise: flip };
			}
			const shown = build(card.path[step] ?? 'flip');
			const figure = 'figure' in shown ? shown.figure : undefined;
			if (!figure) return { cardId: card.id, exercise: flip };
			return { cardId: card.id, exercise: { ...flip, prompt: shown.prompt, figure } };
		});
	}

	/** The next pass of the deck: the "Still learning" cards, in swipe order. */
	nextPass(swipes: readonly { id: CardId; know: boolean }[]): CardId[] {
		return nextDeckPass(swipes);
	}

	/** Starts the quick quiz: every in-scope card once, its format rotated from its path. */
	async startQuiz(courseId: CourseId): Promise<StudyView> {
		const { cards } = await this.cards(courseId);
		const { result, trace } = quickQuiz(cards.map(({ id, path }) => ({ id, path })));
		this.deps.logger.debug('practice', 'quiz', trace);
		return this.deps.study.startPlanned(courseId, {
			mode: 'practice',
			cards: result.map(({ id, kind }) => ({ id, kind, required: 1 })),
			plannedMinutes: 0,
			roundBy: 'count'
		});
	}

	/** The quick quiz's summary, from the session's review events. */
	async quizSummary(sessionId: SessionId): Promise<QuizSummary> {
		const reviews = (await this.deps.events.listBySession(sessionId))
			.filter(isReview)
			.sort((a, b) => a.seq - b.seq);
		const first = reviews.filter((event) => event.firstAttempt);
		const asked = new Set(reviews.map((event) => event.cardId));
		const missed = missesToRetry(reviews.map((e) => ({ id: e.cardId, correct: e.correct })));
		const right = new Set(first.filter((e) => e.correct).map((e) => e.cardId));
		for (const id of missed) right.delete(id);
		return { asked: asked.size, right: right.size, missed };
	}

	/** The course's in-scope, unsuspended, studyable cards in course order. */
	private async cards(courseId: CourseId): Promise<{ material: CourseMaterial; cards: Card[] }> {
		const material = await loadCourse(this.deps.repos, courseId);
		const scope = await courseScope(this.deps.kv, courseId);
		const placed = material.cards.flatMap((card) => {
			const note = material.notes.get(card.noteId);
			if (card.suspended || !note || !isStudyable(note)) return [];
			return [{ card, topicId: note.topicId, chunkId: note.chunkId ?? null }];
		});
		return { material, cards: scopeItems(placed, scope).map((entry) => entry.card) };
	}
}
