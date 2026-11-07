import type { CardRepo } from '#lib/db/repos/content-repos.ts';
import type { EventRepo } from '#lib/db/repos/event-repo.ts';
import type { SessionRepo } from '#lib/db/repos/session-repo.ts';
import type { CardId, CourseId, ExerciseKind, Mode, SessionId } from '#lib/db/schemas/common.ts';
import type { NewStudyEvent, ReviewEvent } from '#lib/db/schemas/event.ts';
import type { Session, SessionSnapshot } from '#lib/db/schemas/session.ts';
import { weightOf } from '#lib/engine/exercise-kinds.ts';
import { retrievabilityAt } from '#lib/engine/fsrs.ts';
import { applyAnswer, currentItem, type CurrentItem } from '#lib/engine/queue.ts';
import {
	isSessionComplete,
	planSession,
	sessionPhase,
	startCleanup,
	type PlanCard
} from '#lib/engine/session.ts';
import type { Logger } from '#lib/log/logger.ts';
import type { ReplayConfigSource, ReplayService } from './replay-service.ts';

/** What `SessionService` needs; all injected so tests can pass fakes. */
export interface SessionServiceDeps {
	sessions: SessionRepo;
	events: EventRepo;
	cards: CardRepo;
	replay: ReplayService;
	replayConfig: ReplayConfigSource;
	clock: () => number;
	newId: () => string;
	logger: Logger;
}

/** A new session: its scope and the cards chosen for it, in priority order. */
export interface StartSessionInput {
	mode: Mode;
	courseIds: CourseId[];
	plannedMinutes: number;
	cards: readonly PlanCard[];
	confusionEvents: readonly Pick<ReviewEvent, 'cardId' | 'chosenFromCardId'>[];
}

/** The student's answer to the current card, as graded by the exercise. */
export interface AnswerInput {
	kind: ExerciseKind;
	correct: boolean;
	responseMs: number;
	/** False for same-day acquisition chunk-quiz answers (DATA_MODEL §3.6). */
	credited: boolean;
	chosen?: string;
	chosenFromCardId?: CardId;
}

/** A session and the card to show next (null when it is complete). */
export interface SessionView {
	session: Session;
	item: CurrentItem | null;
}

/**
 * Runs a study session over the pure queue: logs every answer as a review event together with
 * the new snapshot in one transaction, then replays the answered card, so a closed tab resumes
 * exactly and replay never sees an answer the queue missed. Answers to one session run one at a
 * time, so a double tap can't answer the same card twice.
 *
 * @see BUILD_PLAN §6.4 and DATA_MODEL §3.7
 */
export class SessionService {
	/** The last pending answer per session; each new answer waits for it. */
	private readonly pending = new Map<SessionId, Promise<unknown>>();

	constructor(private readonly deps: SessionServiceDeps) {}

	/** Plans and saves a new session. A plan with no cards is complete at once. */
	async start(input: StartSessionInput): Promise<SessionView> {
		const { result: snapshot, trace } = planSession(input);
		const session: Session = {
			id: this.deps.newId() as SessionId,
			mode: input.mode,
			courseIds: input.courseIds,
			startedAt: this.deps.clock(),
			plannedMinutes: input.plannedMinutes,
			phase: sessionPhase(snapshot),
			snapshot
		};
		await this.deps.sessions.save(session);
		this.deps.logger.info('session', 'started', { mode: input.mode, cards: snapshot.queue.length });
		this.deps.logger.debug('session', 'plan', trace);
		return this.view(await this.settle(session));
	}

	/** Reloads a saved session, e.g. after the tab was closed. */
	async resume(id: SessionId): Promise<SessionView | undefined> {
		const session = await this.deps.sessions.get(id);
		return session && this.view(await this.settle(session));
	}

	/** Records an answer to the current card and moves the session on. */
	answer(id: SessionId, input: AnswerInput): Promise<SessionView> {
		const run = (this.pending.get(id) ?? Promise.resolve())
			.catch(() => undefined)
			.then(() => this.answerNow(id, input));
		this.pending.set(id, run);
		return run;
	}

	private async answerNow(id: SessionId, input: AnswerInput): Promise<SessionView> {
		const session = await this.deps.sessions.get(id);
		const item = session && currentItem(session.snapshot);
		if (!session || !item) throw new Error(`Session ${id} has no current card`);
		const answered = applyAnswer(session.snapshot, {
			cardId: item.cardId,
			correct: input.correct,
			weight: weightOf(input.kind)
		});
		const next = this.updated(session, answered.result);
		await this.deps.events.appendWithSession(this.reviewFields(session, item, input), next);
		await this.deps.replay.rebuildCards([item.cardId]);
		this.deps.logger.debug('session', 'answer', answered.trace);
		return this.view(await this.settle(next));
	}

	/**
	 * Starts cleanup once the main queue has emptied and saves the result. Safe to repeat: it
	 * does nothing once cleanup has run, so `resume` finishes it after a crash.
	 */
	private async settle(session: Session): Promise<Session> {
		const { snapshot } = session;
		if (snapshot.queue.length > 0 || snapshot.cleanup) return session;
		const next = this.updated(session, await this.withCleanup(snapshot));
		await this.deps.sessions.save(next);
		if (next.endedAt !== undefined) this.deps.logger.info('session', 'ended', { id: next.id });
		return next;
	}

	private reviewFields(session: Session, item: CurrentItem, input: AnswerInput): NewStudyEvent {
		return {
			type: 'review',
			cardId: item.cardId,
			sessionId: session.id,
			mode: session.mode,
			kind: input.kind,
			weight: weightOf(input.kind),
			firstAttempt: item.firstAttempt,
			correct: input.correct,
			responseMs: input.responseMs,
			credited: input.credited,
			...(input.chosen === undefined ? {} : { chosen: input.chosen }),
			...(input.chosenFromCardId === undefined ? {} : { chosenFromCardId: input.chosenFromCardId })
		};
	}

	/** Starts cleanup once the main queue empties, weakest (lowest retrievability) first. */
	private async withCleanup(snapshot: SessionSnapshot): Promise<SessionSnapshot> {
		const now = this.deps.clock();
		const config = await this.deps.replayConfig();
		const ids = Object.keys(snapshot.cards) as CardId[];
		const cards = await Promise.all(ids.map((cardId) => this.deps.cards.get(cardId)));
		const retrievability: Record<CardId, number> = {};
		ids.forEach((cardId, i) => {
			retrievability[cardId] = retrievabilityAt(cards[i]?.fsrs ?? null, now, config.fsrs);
		});
		return startCleanup(snapshot, retrievability).result;
	}

	private updated(session: Session, snapshot: SessionSnapshot): Session {
		const complete = isSessionComplete(snapshot);
		return {
			...session,
			phase: sessionPhase(snapshot),
			snapshot,
			...(complete ? { endedAt: this.deps.clock() } : {})
		};
	}

	private view(session: Session): SessionView {
		return { session, item: currentItem(session.snapshot) };
	}
}
