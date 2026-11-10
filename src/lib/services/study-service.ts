import type { CardRepo, CourseRepo, NoteRepo, TopicRepo } from '#lib/db/repos/content-repos.ts';
import type { EventRepo } from '#lib/db/repos/event-repo.ts';
import type { KvRepo } from '#lib/db/repos/kv-repo.ts';
import type {
	CardId,
	CourseId,
	EventId,
	ExerciseKind,
	Mode,
	SessionId
} from '#lib/db/schemas/common.ts';
import type { ReviewEvent, StudyEvent } from '#lib/db/schemas/event.ts';
import { DEFAULT_SETTINGS } from '#lib/db/schemas/kv.ts';
import { confusionCounts } from '#lib/engine/distractors.ts';
import { checkResponse, type ExerciseResponse } from '#lib/engine/exercise-check.ts';
import { currentStep } from '#lib/engine/exercise-kinds.ts';
import { buildExercise, exerciseKindFor, type ExerciseSpec } from '#lib/engine/exercise-spec.ts';
import { checkAccept } from '#lib/engine/grading.ts';
import { rngFor } from '#lib/engine/rng.ts';
import { toPlanCard } from '#lib/engine/session.ts';
import type { Logger } from '#lib/log/logger.ts';
import type { ReplayService } from './replay-service.ts';
import type { SelfRatedInput, SessionService, SessionView } from './session-service.ts';
import { exerciseCourse, loadCourse, practiceCards, type CourseMaterial } from './study-course.ts';
import type { StudyAnswer, StudyItem, StudyView } from './study-types.ts';

/** What `StudyService` needs; injected so tests can pass real repos on a fake database. */
export interface StudyServiceDeps {
	sessions: SessionService;
	repos: { courses: CourseRepo; topics: TopicRepo; notes: NoteRepo; cards: CardRepo };
	events: EventRepo;
	kv: KvRepo;
	replay: ReplayService;
	clock: () => number;
	logger: Logger;
}

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

/** A session a mode has planned. Acquisition answers are logged with `credited: false`. */
export interface PlannedSession {
	mode: Mode;
	cards: readonly PlannedCard[];
	plannedMinutes: number;
}

/** Kinds answered by typing, after which the next showing uses first-letter mode (§6.10). */
const TYPED_KINDS: ReadonlySet<ExerciseKind> = new Set([
	'cloze',
	'firstLetterType',
	'fadeStep',
	'newInstance'
]);

const isReview = (event: StudyEvent): event is ReviewEvent => event.type === 'review';

/**
 * The study screen's service: starts practice sessions, builds the exercise for the current card
 * (`buildExercise`), grades the response (`checkResponse`) and logs it through `SessionService`.
 *
 * @see BUILD_PLAN §5.1, §6.4, §6.10 and Decisions log (Phase 5)
 */
export class StudyService {
	private readonly material = new Map<SessionId, CourseMaterial>();
	private readonly forced = new Map<SessionId, Partial<Record<CardId, ExerciseKind>>>();
	private readonly shown = new Map<SessionId, { spec: ExerciseSpec; at: number }>();
	private readonly answered = new Map<SessionId, ExerciseSpec>();
	private readonly modes = new Map<SessionId, Mode>();

	constructor(private readonly deps: StudyServiceDeps) {}

	/**
	 * Starts a `longterm` practice session of a course (the dev harness and tests use it).
	 *
	 * @see Decisions log (Phase 5: practice sessions)
	 */
	async startCourse(courseId: CourseId, options: StartOptions = {}): Promise<StudyView> {
		const material = await loadCourse(this.deps.repos, courseId);
		const forced = options.forceKinds ?? {};
		const chosen = options.cardIds
			? options.cardIds.flatMap((id) => material.cards.filter((card) => card.id === id))
			: practiceCards(material);
		return this.startPlanned(courseId, {
			mode: 'longterm',
			plannedMinutes: 0,
			cards: chosen.map((card) => ({
				id: card.id,
				...(forced[card.id] ? { kind: forced[card.id] } : {})
			}))
		});
	}

	/**
	 * Starts a session a mode planned: cards in the given order, each with its criterion from
	 * `toPlanCard` unless the plan sets `required`, and its first showing forced to `kind` when set.
	 *
	 * @see BUILD_PLAN §6.4, §6.6–§6.8
	 */
	async startPlanned(courseId: CourseId, plan: PlannedSession): Promise<StudyView> {
		const material = await loadCourse(this.deps.repos, courseId);
		const events = await this.deps.events.list();
		const byId = new Map(material.cards.map((card) => [card.id, card]));
		const forced: Partial<Record<CardId, ExerciseKind>> = {};
		const cards = plan.cards.flatMap((planned) => {
			const card = byId.get(planned.id);
			if (!card) return [];
			const note = material.notes.get(card.noteId);
			const base = toPlanCard(card, note?.type ?? 'fact', events, {
				mode: plan.mode,
				relearningSessionsAhead: planned.relearningSessionsAhead ?? 0
			});
			if (planned.kind) forced[card.id] = planned.kind;
			return [
				{ ...base, kind: planned.kind ?? base.kind, required: planned.required ?? base.required }
			];
		});
		const view = await this.deps.sessions.start({
			mode: plan.mode,
			courseIds: [courseId],
			plannedMinutes: plan.plannedMinutes,
			cards,
			confusionEvents: events.filter(isReview)
		});
		this.material.set(view.session.id, material);
		this.forced.set(view.session.id, forced);
		return this.present(view);
	}

	/** Active courses, for choosing what to practise. */
	async listCourses(): Promise<StudyView['course'][]> {
		const courses = await this.deps.repos.courses.list();
		return courses
			.filter((course) => course.status === 'active')
			.map(({ id, name, color }) => ({ id, name, color }));
	}

	/** Reopens a session, e.g. after a reload. */
	async open(id: SessionId): Promise<StudyView | undefined> {
		const view = await this.deps.sessions.resume(id);
		return view && this.present(view);
	}

	/** Grades the response to the card on screen, logs it and moves the session on. */
	async submit(id: SessionId, response: ExerciseResponse): Promise<StudyAnswer> {
		const shown = this.shown.get(id);
		if (!shown) throw new Error(`Session ${id} has no exercise on screen`);
		const { result: verdict, trace } = checkResponse(shown.spec, response);
		this.deps.logger.debug('study', 'check', trace);
		const view = await this.deps.sessions.answer(id, {
			kind: shown.spec.kind,
			correct: verdict.correct,
			responseMs: this.deps.clock() - shown.at,
			// Same-day acquisition answers give no scheduling credit (BUILD_PLAN §6.7).
			credited: this.modes.get(id) !== 'acquisition',
			...(verdict.chosen === undefined ? {} : { chosen: verdict.chosen }),
			...(verdict.chosenFromCardId ? { chosenFromCardId: verdict.chosenFromCardId } : {}),
			...selfRatedOf(shown.spec, response)
		});
		this.answered.set(id, shown.spec);
		const reviewEventId = await this.lastReviewId(id, shown.spec.cardId);
		return { verdict, view: await this.present(view), ...(reviewEventId ? { reviewEventId } : {}) };
	}

	/**
	 * "I was right": adds the typed text to the card's accept list and logs `acceptAdded`, naming
	 * the review (so replay re-judges it) only when the text passes the collision guard.
	 *
	 * @see BUILD_PLAN §6.10 (accept list) and Decisions log (Phase 5: "I was right")
	 */
	async acceptTyped(
		id: SessionId,
		input: { typed: string; reviewEventId?: EventId }
	): Promise<{ passesGuard: boolean }> {
		const { spec, material, card, note } = this.acceptTarget(id);
		const { normalized, passesGuard } = checkAccept(card.id, input.typed, spec.others).result;
		const accept = {
			...note.accept,
			[card.variant]: [...(note.accept[card.variant] ?? []), normalized]
		};
		material.notes.set(note.id, await this.deps.repos.notes.update(note.id, { accept }));
		const rejudge =
			passesGuard && input.reviewEventId ? { reviewEventId: input.reviewEventId } : {};
		await this.deps.events.append({
			type: 'acceptAdded',
			noteId: note.id,
			variant: card.variant,
			value: normalized,
			...rejudge
		});
		await this.deps.replay.rebuildCards([card.id]);
		return { passesGuard };
	}

	/** Opens the next round; see `SessionService.continueRound`. */
	async continueRound(id: SessionId, options: { afterBreak: boolean }): Promise<StudyView> {
		return this.present(await this.deps.sessions.continueRound(id, options));
	}

	/** Stop here, keeping all progress. */
	async stop(id: SessionId): Promise<StudyView> {
		return this.present(await this.deps.sessions.stop(id));
	}

	/** The typed exercise just answered, with its card and note. */
	private acceptTarget(id: SessionId) {
		const spec = this.answered.get(id);
		const material = this.material.get(id);
		const card = spec && material?.cards.find((candidate) => candidate.id === spec.cardId);
		const note = card && material?.notes.get(card.noteId);
		if (spec?.shape !== 'type' || !material || !card || !note) throw new Error('Nothing to accept');
		return { spec, material, card, note };
	}

	private async lastReviewId(id: SessionId, cardId: CardId): Promise<EventId | undefined> {
		const events = (await this.deps.events.listBySession(id)).filter(
			(event) => isReview(event) && event.cardId === cardId
		);
		return events.sort((a, b) => b.seq - a.seq)[0]?.id;
	}

	private async materialFor(view: SessionView): Promise<CourseMaterial> {
		const cached = this.material.get(view.session.id);
		if (cached) return cached;
		const courseId = view.session.courseIds[0];
		if (!courseId) throw new Error(`Session ${view.session.id} has no course`);
		const material = await loadCourse(this.deps.repos, courseId);
		this.material.set(view.session.id, material);
		return material;
	}

	private async present(view: SessionView): Promise<StudyView> {
		const { session } = view;
		this.modes.set(session.id, session.mode);
		const material = await this.materialFor(view);
		const states = Object.values(session.snapshot.cards);
		const item = view.item ? await this.buildItem(view, material) : null;
		if (!item) this.shown.delete(session.id);
		return {
			sessionId: session.id,
			mode: session.mode,
			course: { id: material.course.id, name: material.course.name, color: material.course.color },
			phase: session.phase,
			ended: session.endedAt !== undefined,
			item,
			round: view.round,
			progress: { done: states.filter((card) => card.done).length, total: states.length },
			summary: session.endedAt === undefined ? null : await this.summaryOf(view)
		};
	}

	/** Cards practised in the session and how many now count as learned. */
	private async summaryOf(view: SessionView): Promise<{ practised: number; ready: number }> {
		const ids = Object.keys(view.session.snapshot.cards) as CardId[];
		const cards = await Promise.all(ids.map((cardId) => this.deps.repos.cards.get(cardId)));
		const ready = cards.filter(
			(card) => card?.status === 'exam-ready' || card?.status === 'secure'
		);
		return { practised: ids.length, ready: ready.length };
	}

	private async buildItem(view: SessionView, material: CourseMaterial): Promise<StudyItem | null> {
		const item = view.item;
		const card = item && (await this.deps.repos.cards.get(item.cardId));
		if (!item || !card) return null;
		const sessionId = view.session.id;
		const events = await this.deps.events.list();
		const settings = (await this.deps.kv.get('settings')) ?? DEFAULT_SETTINGS;
		const missedTyped = missedTypedIn(events, sessionId, card.id);
		const { path, pathStep, accuracy } = card;
		const kind =
			(item.attempt === 0 ? this.forced.get(sessionId)?.[card.id] : undefined) ??
			exerciseKindFor({
				path,
				pathStep,
				accuracy,
				spellingMode: settings.spellingMode,
				missedTyped
			});
		const { result: exercise, trace } = buildExercise({
			kind,
			card: {
				id: card.id,
				noteId: card.noteId,
				variant: card.variant,
				path,
				step: currentStep(path, pathStep, accuracy)
			},
			course: exerciseCourse(material),
			confusions: confusionCounts(events.filter(isReview), card.id),
			rng: rngFor(card.id, sessionId, item.attempt)
		});
		this.deps.logger.debug('study', 'exercise', trace);
		this.shown.set(sessionId, { spec: exercise, at: this.deps.clock() });
		return {
			cardId: card.id,
			exercise,
			firstAttempt: item.firstAttempt,
			phase: item.phase,
			dots: { count: item.count, required: item.required }
		};
	}
}

/** The card's previous review in this session was a wrong typed answer (§6.10 first-letter mode). */
function missedTypedIn(
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
function selfRatedOf(
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
