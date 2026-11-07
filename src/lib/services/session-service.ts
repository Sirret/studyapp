import type { CardRepo } from '#lib/db/repos/content-repos.ts';
import type { EventRepo } from '#lib/db/repos/event-repo.ts';
import type { SessionRepo } from '#lib/db/repos/session-repo.ts';
import type { CardId, CourseId, ExerciseKind, Mode, SessionId } from '#lib/db/schemas/common.ts';
import type { ReviewEvent } from '#lib/db/schemas/event.ts';
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
 * Runs a study session over the pure queue: logs every answer as a review event, replays the
 * answered card, and saves the snapshot after every answer so a closed tab resumes exactly. The
 * event is written before the snapshot, so a crash in between can repeat a question but never
 * lose an answer.
 *
 * @see BUILD_PLAN §6.4 and DATA_MODEL §3.7
 */
export class SessionService {
	constructor(private readonly deps: SessionServiceDeps) {}

	/** Plans and saves a new session. */
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
		return this.view(session);
	}

	/** Reloads a saved session, e.g. after the tab was closed. */
	async resume(id: SessionId): Promise<SessionView | undefined> {
		const session = await this.deps.sessions.get(id);
		return session && this.view(session);
	}

	/** Records an answer to the current card and moves the session on. */
	async answer(id: SessionId, input: AnswerInput): Promise<SessionView> {
		const session = await this.deps.sessions.get(id);
		const item = session && currentItem(session.snapshot);
		if (!session || !item) throw new Error(`Session ${id} has no current card`);
		await this.logAnswer(session, item, input);
		await this.deps.replay.rebuildCards([item.cardId]);
		const answered = applyAnswer(session.snapshot, {
			cardId: item.cardId,
			correct: input.correct,
			weight: weightOf(input.kind)
		});
		const snapshot = await this.withCleanup(answered.result);
		const next = this.updated(session, snapshot);
		await this.deps.sessions.save(next);
		this.deps.logger.debug('session', 'answer', answered.trace);
		if (next.endedAt !== undefined) this.deps.logger.info('session', 'ended', { id });
		return this.view(next);
	}

	private async logAnswer(session: Session, item: CurrentItem, input: AnswerInput): Promise<void> {
		await this.deps.events.append({
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
		});
	}

	/** Starts cleanup once the main queue empties, weakest (lowest retrievability) first. */
	private async withCleanup(snapshot: SessionSnapshot): Promise<SessionSnapshot> {
		if (snapshot.queue.length > 0 || snapshot.cleanup) return snapshot;
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
