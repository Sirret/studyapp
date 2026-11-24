import type {
	CardId,
	CourseId,
	EventId,
	ExerciseKind,
	MediaId,
	SessionId
} from '#lib/db/schemas/common.ts';
import { DEFAULT_SETTINGS } from '#lib/db/schemas/kv.ts';
import { checkResponse, type ExerciseResponse } from '#lib/engine/exercise-check.ts';
import type { ExerciseSpec } from '#lib/engine/exercise-spec.ts';
import { checkAccept } from '#lib/engine/grading.ts';
import { microHint, type MicroHint } from '#lib/engine/hint.ts';
import { rngFor } from '#lib/engine/rng.ts';
import { toPlanCard } from '#lib/engine/session.ts';
import type { SessionView } from './session-service.ts';
import { answerOf, creditedIn, isReview, selfRatedOf, type Shown } from './study-answer.ts';
import { loadCourse, practiceCards, type CourseMaterial } from './study-course.ts';
import { cardExercise } from './study-item.ts';
import type { PlannedSession, StartOptions } from './study-plan-types.ts';
import type { StudyServiceDeps } from './study-deps.ts';
import type { StudyAnswer, StudyItem, StudyView } from './study-types.ts';

export type { PlannedCard, PlannedSession, StartOptions } from './study-plan-types.ts';
export type { StudyServiceDeps } from './study-deps.ts';

/**
 * The study screen's service: starts practice sessions, builds the exercise for the current card
 * (`buildExercise`), grades the response (`checkResponse`) and logs it through `SessionService`.
 *
 * @see BUILD_PLAN §5.1, §6.4, §6.10 and Decisions log (Phase 5)
 */
export class StudyService {
	private readonly material = new Map<SessionId, CourseMaterial>();
	private readonly forced = new Map<SessionId, Partial<Record<CardId, ExerciseKind>>>();
	private readonly shown = new Map<SessionId, Shown>();
	private readonly answered = new Map<SessionId, ExerciseSpec>();
	private readonly modes = new Map<SessionId, PlannedSession['mode']>();

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
			confusionEvents: events.filter(isReview),
			...(plan.roundBy ? { roundBy: plan.roundBy } : {})
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

	/**
	 * The micro hint for the exercise on screen; the answer is then logged `hinted: true`. One per
	 * attempt: asking again gives the same hint.
	 *
	 * @see SESSION_NOTES J (micro hint); Decisions log "Phase 8.6 Q10"
	 */
	hint(id: SessionId): MicroHint {
		const shown = this.shown.get(id);
		if (!shown) throw new Error(`Session ${id} has no exercise on screen`);
		const { result, trace } = microHint(shown.spec, rngFor(shown.spec.cardId, id, shown.attempt));
		this.deps.logger.debug('study', 'hint', trace);
		if (result.kind !== 'none') shown.hinted = true;
		return result;
	}

	/** Grades the response to the card on screen, logs it and moves the session on. */
	async submit(id: SessionId, response: ExerciseResponse): Promise<StudyAnswer> {
		const shown = this.shown.get(id);
		if (!shown) throw new Error(`Session ${id} has no exercise on screen`);
		const { result: verdict, trace } = checkResponse(shown.spec, response);
		this.deps.logger.debug('study', 'check', trace);
		const wasReady = await this.isReady(shown.spec.cardId);
		const view = await this.deps.sessions.answer(id, {
			...answerOf(shown, verdict, this.deps.clock()),
			credited: creditedIn(this.modes.get(id)),
			...selfRatedOf(shown.spec, response)
		});
		this.answered.set(id, shown.spec);
		const reviewEventId = await this.lastReviewId(id, shown.spec.cardId);
		const becameReady = !wasReady && (await this.isReady(shown.spec.cardId));
		return {
			verdict,
			view: await this.present(view),
			becameReady,
			...(reviewEventId ? { reviewEventId } : {})
		};
	}

	/** Whether the card counts as learned (exam-ready or secure), for the stamp sound. */
	private async isReady(cardId: CardId): Promise<boolean> {
		const status = (await this.deps.repos.cards.get(cardId))?.status;
		return status === 'exam-ready' || status === 'secure';
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
	/**
	 * An image's bytes, for a figure (`spec.figure.mediaId`) or "Show original" (`sourceMediaId`);
	 * `null` when it is gone. The screen makes the object URL (`createMediaUrl`) and revokes it.
	 *
	 * @see BUILD_PLAN §7; WIP step 7
	 */
	async media(id: MediaId): Promise<Blob | null> {
		return (await this.deps.repos.media.get(id))?.blob ?? null;
	}

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
		const ready = await Promise.all(ids.map((cardId) => this.isReady(cardId)));
		return { practised: ids.length, ready: ready.filter(Boolean).length };
	}

	private async buildItem(view: SessionView, material: CourseMaterial): Promise<StudyItem | null> {
		const item = view.item;
		const card = item && (await this.deps.repos.cards.get(item.cardId));
		if (!item || !card) return null;
		const sessionId = view.session.id;
		const { result: exercise, trace } = cardExercise({
			card,
			sessionId,
			attempt: item.attempt,
			forced: item.attempt === 0 ? this.forced.get(sessionId)?.[card.id] : undefined,
			events: await this.deps.events.list(),
			settings: (await this.deps.kv.get('settings')) ?? DEFAULT_SETTINGS,
			material
		});
		this.deps.logger.debug('study', 'exercise', trace);
		this.shown.set(sessionId, {
			spec: exercise,
			at: this.deps.clock(),
			attempt: item.attempt,
			hinted: false
		});
		return {
			cardId: card.id,
			exercise,
			firstAttempt: item.firstAttempt,
			phase: item.phase,
			dots: { count: item.count, required: item.required }
		};
	}
}
