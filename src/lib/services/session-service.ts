import type { CardRepo } from '#lib/db/repos/content-repos.ts';
import type { EventRepo } from '#lib/db/repos/event-repo.ts';
import type { SessionRepo } from '#lib/db/repos/session-repo.ts';
import type { CardId, CourseId, ExerciseKind, Mode, SessionId } from '#lib/db/schemas/common.ts';
import type { NewStudyEvent, ReviewEvent } from '#lib/db/schemas/event.ts';
import type { Session, SessionSnapshot } from '#lib/db/schemas/session.ts';
import { weightOf } from '#lib/engine/exercise-kinds.ts';
import { retrievabilityAt } from '#lib/engine/fsrs.ts';
import { applyAnswer, currentItem, type CurrentItem } from '#lib/engine/queue.ts';
import { checkRoundEnd, roundSummary, startRound, type RoundSummary } from '#lib/engine/round.ts';
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

/**
 * A session, the card to show next (null between rounds and once it ends), and the summary of
 * the round that just ended (null while a round runs or once the session ends).
 */
export interface SessionView {
	session: Session;
	item: CurrentItem | null;
	round: RoundSummary | null;
}

/**
 * Runs a study session over the pure queue: logs every answer as a review event together with
 * the new snapshot in one transaction, then replays the answered card, so a closed tab resumes
 * exactly and replay never sees an answer the queue missed. Changes to one session run one at a
 * time, so a double tap can't answer the same card twice. Between rounds the student chooses
 * Continue (`continueRound`, after a break or not) or Stop here (`stop`); nothing is forced.
 *
 * @see BUILD_PLAN §6.4 and DATA_MODEL §3.7
 */
export class SessionService {
	/** The last pending change per session; each new change waits for it. */
	private readonly pending = new Map<SessionId, Promise<unknown>>();

	constructor(private readonly deps: SessionServiceDeps) {}

	/** Plans and saves a new session. A plan with no cards is complete at once. */
	async start(input: StartSessionInput): Promise<SessionView> {
		const { result: snapshot, trace } = planSession({ ...input, now: this.deps.clock() });
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
		return this.serially(id, () => this.answerNow(id, input));
	}

	/** Opens the next round after a round summary; `afterBreak` restarts the break timer. */
	continueRound(id: SessionId, options: { afterBreak: boolean }): Promise<SessionView> {
		return this.serially(id, async () => {
			const session = await this.load(id);
			const { result, trace } = startRound(session.snapshot, this.deps.clock(), options);
			const next = this.updated(session, result);
			await this.deps.sessions.save(next);
			this.deps.logger.debug('session', 'round', trace);
			return this.view(next);
		});
	}

	/** Stop here: ends the session now, keeping every answer and all progress. */
	stop(id: SessionId): Promise<SessionView> {
		return this.serially(id, async () => {
			const session = await this.load(id);
			const next =
				session.endedAt === undefined ? { ...session, endedAt: this.deps.clock() } : session;
			await this.deps.sessions.save(next);
			this.deps.logger.info('session', 'stopped', { id });
			return this.view(next);
		});
	}

	private serially(id: SessionId, change: () => Promise<SessionView>): Promise<SessionView> {
		const run = (this.pending.get(id) ?? Promise.resolve()).catch(() => undefined).then(change);
		this.pending.set(id, run);
		return run;
	}

	private async load(id: SessionId): Promise<Session> {
		const session = await this.deps.sessions.get(id);
		if (!session) throw new Error(`No session ${id}`);
		return session;
	}

	private async answerNow(id: SessionId, input: AnswerInput): Promise<SessionView> {
		const session = await this.deps.sessions.get(id);
		const item = session && session.endedAt === undefined && currentItem(session.snapshot);
		if (!session || !item) throw new Error(`Session ${id} has no current card`);
		const answered = applyAnswer(session.snapshot, {
			cardId: item.cardId,
			correct: input.correct,
			weight: weightOf(input.kind)
		});
		const snapshot = checkRoundEnd(answered.result, this.deps.clock()).result;
		const next = this.updated(session, snapshot);
		const required = snapshot.cards[item.cardId]?.required ?? item.required;
		await this.deps.events.appendWithSession(
			this.reviewFields(session, item, input, required),
			next
		);
		await this.deps.replay.rebuildCards([item.cardId]);
		this.deps.logger.debug('session', 'answer', answered.trace);
		return this.view(await this.settle(next));
	}

	/**
	 * Starts cleanup once every card is done (round queue and backlog empty) and saves the result.
	 * Safe to repeat: it does nothing once cleanup has run, so `resume` finishes it after a crash.
	 */
	private async settle(session: Session): Promise<Session> {
		const { snapshot } = session;
		const cardsLeft = snapshot.queue.length > 0 || snapshot.backlog.length > 0;
		if (cardsLeft || snapshot.cleanup || session.endedAt !== undefined) return session;
		const next = this.updated(session, await this.withCleanup(snapshot));
		await this.deps.sessions.save(next);
		if (next.endedAt !== undefined) this.deps.logger.info('session', 'ended', { id: next.id });
		return next;
	}

	private reviewFields(
		session: Session,
		item: CurrentItem,
		input: AnswerInput,
		required: number
	): NewStudyEvent {
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
			required,
			...(input.chosen === undefined ? {} : { chosen: input.chosen }),
			...(input.chosenFromCardId === undefined ? {} : { chosenFromCardId: input.chosenFromCardId })
		};
	}

	/** Starts cleanup, weakest (lowest retrievability) first. */
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
		if (session.endedAt !== undefined) return { session, item: null, round: null };
		const { snapshot } = session;
		const round = snapshot.round.ended ? roundSummary(snapshot, this.deps.clock()) : null;
		return { session, item: currentItem(snapshot), round };
	}
}
