import { describe, expect, it } from 'vitest';
import {
	CRITERION_FIRST,
	CRITERION_FIRST_REDUCED,
	CRITERION_LATER,
	MC_UNTIL_ACCURACY,
	RELEARN_OVERRIDE_SESSIONS
} from '#lib/config/defaults.ts';
import type { Card } from '#lib/db/schemas/card.ts';
import type { CardStatus, Mode, SessionId } from '#lib/db/schemas/common.ts';
import type { ReviewEvent, StudyEvent } from '#lib/db/schemas/event.ts';
import { requiredCorrects, type CriterionContext } from '#lib/engine/criterion.ts';
import {
	criterionHistory,
	emptyCriterionHistory,
	hasMetCriterion,
	recordCriterion
} from '#lib/engine/criterion-history.ts';
import { toPlanCard, type PlanContext } from '#lib/engine/session.ts';
import {
	cardId,
	eventId,
	makeAcceptAdded,
	makePretest,
	makeReview,
	makeSelfRated,
	noteId,
	uuid
} from './fixtures.ts';

/**
 * Adaptive first-session criterion: the known-on-first-try facts, the relearn flag per session,
 * `requiredCorrects`, and `toPlanCard` with its context.
 *
 * @see BUILD_PLAN §6.3, §6.4 and Decisions log (adaptive criterion, known on first try, review
 *   `required`, weak); DATA_MODEL §3.6, §3.7; CONCEPT §5
 */

const S1 = uuid(0x5a1) as SessionId;
const S2 = uuid(0x5a2) as SessionId;
const S3 = uuid(0x5a3) as SessionId;
const CARD = cardId(1);

/** Builds a card's events with increasing ts/seq and unique ids, in replay order. */
function events() {
	const list: StudyEvent[] = [];
	const meta = () => {
		const n = list.length + 1;
		return { id: eventId(0x2000 + n), seq: n, ts: 1_000 * n };
	};
	const api = {
		list,
		review(sessionId: SessionId, overrides: Partial<ReviewEvent> = {}) {
			list.push(makeReview({ ...meta(), cardId: CARD, sessionId, mode: 'cram', ...overrides }));
			return api;
		},
		pretest() {
			list.push(makePretest({ ...meta(), cardId: CARD }));
			return api;
		},
		selfRated() {
			list.push(makeSelfRated({ ...meta(), cardId: CARD }));
			return api;
		},
		acceptAdded() {
			list.push(makeAcceptAdded(meta()));
			return api;
		}
	};
	return api;
}

const ok = (o: Partial<ReviewEvent> = {}): Partial<ReviewEvent> => ({ correct: true, ...o });
const no = (o: Partial<ReviewEvent> = {}): Partial<ReviewEvent> => ({ correct: false, ...o });

describe('criterionHistory: known-on-first-try facts (Decisions log: known on first try)', () => {
	it('starts empty: nothing attempted, pretested, known or met, no sessions', () => {
		const history = criterionHistory([]);
		expect(history).toStrictEqual(emptyCriterionHistory());
		expect(history.attempted).toBe(false);
		expect(history.pretested).toBe(false);
		expect(history.knownOnFirstTry).toBe(false);
		expect(history.metEver).toBe(false);
		expect(history.sessions.size).toBe(0);
	});

	it('marks pretested but not attempted after a pretest alone', () => {
		const history = criterionHistory(events().pretest().list);
		expect(history.pretested).toBe(true);
		expect(history.attempted).toBe(false);
		expect(history.knownOnFirstTry).toBe(false);
	});

	it('is known on first try when the first review is a correct full answer', () => {
		const history = criterionHistory(events().review(S1, ok()).list);
		expect(history.attempted).toBe(true);
		expect(history.knownOnFirstTry).toBe(true);
	});

	it('is known on first try when the first review is a correct recognition answer', () => {
		const e = events().review(S1, ok({ kind: 'mc', weight: 'recognition' }));
		expect(criterionHistory(e.list).knownOnFirstTry).toBe(true);
	});

	it('is known on first try from an uncredited acquisition first review', () => {
		const e = events().review(S1, ok({ mode: 'acquisition', credited: false }));
		const history = criterionHistory(e.list);
		expect(history.knownOnFirstTry).toBe(true);
		expect(history.attempted).toBe(true);
		expect(history.sessions.size).toBe(0);
	});

	it('is not known on first try when the first review is wrong, even after later corrects', () => {
		const e = events()
			.review(S1, no())
			.review(S1, ok({ firstAttempt: false }))
			.review(S2, ok());
		expect(criterionHistory(e.list).knownOnFirstTry).toBe(false);
	});

	it('is not known on first try when the first review is none-weight, even if correct', () => {
		const e = events()
			.review(S1, ok({ kind: 'matching', weight: 'none' }))
			.review(S1, ok());
		const history = criterionHistory(e.list);
		expect(history.attempted).toBe(true);
		expect(history.knownOnFirstTry).toBe(false);
	});

	it('is not known on first try when a pretest came before the first review', () => {
		const history = criterionHistory(events().pretest().review(S1, ok()).list);
		expect(history.pretested).toBe(true);
		expect(history.knownOnFirstTry).toBe(false);
	});

	it('ignores a pretest that comes after the first review', () => {
		const history = criterionHistory(events().review(S1, ok()).pretest().list);
		expect(history.pretested).toBe(false);
		expect(history.knownOnFirstTry).toBe(true);
	});

	it('does not treat self-rated or accept-added events as an attempt', () => {
		const history = criterionHistory(events().selfRated().acceptAdded().list);
		expect(history.attempted).toBe(false);
		expect(history.knownOnFirstTry).toBe(false);
		expect(criterionHistory(events().selfRated().review(S1, ok()).list).knownOnFirstTry).toBe(true);
	});
});

describe('criterionHistory: sessions and the relearn flag (§6.3, Decisions log: weak)', () => {
	it('marks a session relearn only if the criterion was met before it started', () => {
		const e = events()
			.pretest()
			.review(S1, ok())
			.review(S1, ok())
			.review(S1, ok())
			.review(S2, ok());
		const history = criterionHistory(e.list);
		expect(history.metEver).toBe(true);
		expect(history.sessions.get(S1)?.relearn).toBe(false);
		expect(history.sessions.get(S1)?.met).toBe(true);
		expect(history.sessions.get(S1)?.criterion.required).toBe(CRITERION_FIRST);
		expect(history.sessions.get(S2)?.relearn).toBe(true);
		expect(history.sessions.get(S2)?.criterion.required).toBe(CRITERION_LATER);
	});

	it('does not mark the session after an unmet first session as a relearn', () => {
		const e = events().pretest().review(S1, ok()).review(S1, ok()).review(S2, ok());
		const history = criterionHistory(e.list);
		expect(history.metEver).toBe(false);
		expect(history.sessions.get(S2)?.relearn).toBe(false);
	});

	it('fixes a session required and relearn flag at its first counting event when sessions interleave', () => {
		// S1 starts unmet (cram after a pretest: CRITERION_FIRST); S2 (longterm) meets the criterion
		// while S1 is still open; S1 keeps its required and stays a non-relearn session.
		const e = events()
			.pretest()
			.review(S1, ok())
			.review(S2, ok({ mode: 'longterm' }))
			.review(S2, ok({ mode: 'longterm' }))
			.review(S1, ok());
		const mid = criterionHistory(e.list);
		expect(mid.metEver).toBe(true);
		expect(mid.sessions.get(S2)?.criterion.required).toBe(CRITERION_FIRST_REDUCED);
		expect(mid.sessions.get(S1)?.criterion.required).toBe(CRITERION_FIRST);
		expect(mid.sessions.get(S1)?.relearn).toBe(false);
		expect(mid.sessions.get(S1)?.met).toBe(false);
		e.review(S1, ok()).review(S3, ok());
		const after = criterionHistory(e.list);
		expect(after.sessions.get(S1)?.met).toBe(true);
		expect(after.sessions.get(S1)?.relearn).toBe(false);
		expect(after.sessions.get(S3)?.relearn).toBe(true);
	});

	it('uses the event required when present, and follows later events', () => {
		const e = events()
			.pretest()
			.review(S1, ok({ required: CRITERION_FIRST }))
			.review(S1, ok({ required: CRITERION_FIRST_REDUCED }));
		const session = criterionHistory(e.list).sessions.get(S1);
		expect(session?.criterion.required).toBe(CRITERION_FIRST_REDUCED);
		expect(session?.met).toBe(true);
	});

	it('drops the session required to CRITERION_FIRST_REDUCED right after a first-ever correct', () => {
		const one = criterionHistory(events().review(S1, ok()).list).sessions.get(S1);
		expect(one?.criterion.required).toBe(CRITERION_FIRST_REDUCED);
		expect(one?.met).toBe(false);
		const two = criterionHistory(events().review(S1, ok()).review(S1, ok()).list);
		expect(two.sessions.get(S1)?.met).toBe(true);
		expect(two.metEver).toBe(true);
	});

	it('uses an event required below CRITERION_FIRST_REDUCED on a first-ever correct', () => {
		const e = events().review(S1, ok({ required: CRITERION_LATER }));
		const session = criterionHistory(e.list).sessions.get(S1);
		expect(session?.criterion.required).toBe(CRITERION_LATER);
		expect(session?.met).toBe(true);
	});
});

describe('recordCriterion return value (§6.3)', () => {
	it('returns the session with isFirstOfSession only for the first counting event of each session', () => {
		const history = emptyCriterionHistory();
		const e = events().pretest().review(S1, ok()).review(S1, no()).review(S2, ok()).list;
		const results = e.map((event) => recordCriterion(history, event));
		expect(results[0]).toBeNull();
		expect(results[1]?.isFirstOfSession).toBe(true);
		expect(results[2]?.isFirstOfSession).toBe(false);
		expect(results[2]?.session.criterion.failed).toBe(true);
		expect(results[2]?.session.criterion.count).toBe(0);
		expect(results[3]?.isFirstOfSession).toBe(true);
	});

	it('returns null for non-counting events but still records the first try facts', () => {
		const history = emptyCriterionHistory();
		const warm = events().review(S1, ok({ kind: 'matching', weight: 'none' })).list[0]!;
		expect(recordCriterion(history, warm)).toBeNull();
		expect(history.attempted).toBe(true);
		expect(history.knownOnFirstTry).toBe(false);
		const uncredited = events().review(S1, ok({ credited: false })).list[0]!;
		const fresh = emptyCriterionHistory();
		expect(recordCriterion(fresh, uncredited)).toBeNull();
		expect(fresh.knownOnFirstTry).toBe(true);
	});

	it('agrees with hasMetCriterion and criterionHistory().metEver', () => {
		const cases: StudyEvent[][] = [
			[],
			events().review(S1, ok()).review(S1, ok()).list,
			events().pretest().review(S1, ok()).review(S1, ok()).list,
			events()
				.review(S1, ok({ mode: 'longterm' }))
				.review(S1, ok({ mode: 'longterm' })).list,
			events()
				.pretest()
				.review(S1, ok({ required: CRITERION_FIRST_REDUCED }))
				.review(S1, ok()).list
		];
		const expected = [false, true, false, true, true];
		cases.forEach((list, i) => {
			const history = emptyCriterionHistory();
			for (const event of list) recordCriterion(history, event);
			expect({ i, met: hasMetCriterion(list) }).toStrictEqual({ i, met: expected[i] });
			expect(criterionHistory(list).metEver).toBe(expected[i]);
			expect(history.metEver).toBe(expected[i]);
		});
	});
});

describe('requiredCorrects (§6.3 adaptive first-session criterion)', () => {
	const base: CriterionContext = {
		hasMetCriterion: false,
		knownOnFirstTry: false,
		mode: 'cram',
		relearningSessionsAhead: 0
	};

	it('needs CRITERION_LATER once the criterion was met, whatever else holds', () => {
		expect(requiredCorrects({ ...base, hasMetCriterion: true })).toBe(CRITERION_LATER);
		expect(
			requiredCorrects({ ...base, hasMetCriterion: true, mode: 'longterm', knownOnFirstTry: true })
		).toBe(CRITERION_LATER);
	});

	it('reduces a longterm first session', () => {
		expect(requiredCorrects({ ...base, mode: 'longterm' })).toBe(CRITERION_FIRST_REDUCED);
	});

	it('reduces at exactly RELEARN_OVERRIDE_SESSIONS relearning sessions ahead, not one fewer', () => {
		expect(requiredCorrects({ ...base, relearningSessionsAhead: RELEARN_OVERRIDE_SESSIONS })).toBe(
			CRITERION_FIRST_REDUCED
		);
		expect(
			requiredCorrects({ ...base, relearningSessionsAhead: RELEARN_OVERRIDE_SESSIONS - 1 })
		).toBe(CRITERION_FIRST);
	});

	it('reduces when the card was known on first try', () => {
		expect(requiredCorrects({ ...base, knownOnFirstTry: true })).toBe(CRITERION_FIRST_REDUCED);
	});

	it('keeps CRITERION_FIRST in other modes when nothing reduces it', () => {
		for (const mode of ['cram', 'onenight', 'acquisition'] as const satisfies readonly Mode[]) {
			expect({ mode, required: requiredCorrects({ ...base, mode }) }).toStrictEqual({
				mode,
				required: CRITERION_FIRST
			});
		}
	});
});

describe('toPlanCard (§5, §6.3, DATA_MODEL §3.7 firstEver)', () => {
	type CardInput = Pick<Card, 'id' | 'noteId' | 'path' | 'pathStep' | 'accuracy' | 'status'>;
	const card = (o: Partial<CardInput> = {}): CardInput => ({
		id: CARD,
		noteId: noteId(1),
		path: ['cloze'],
		pathStep: 0,
		accuracy: { n: 0, correct: 0 },
		status: 'unseen',
		...o
	});
	const cram: PlanContext = { mode: 'cram', relearningSessionsAhead: 0 };

	it('copies id, noteId and note type', () => {
		const plan = toPlanCard(card(), 'fact', [], cram);
		expect(plan.id).toBe(CARD);
		expect(plan.noteId).toBe(noteId(1));
		expect(plan.noteType).toBe('fact');
	});

	it('needs CRITERION_FIRST_REDUCED in longterm and CRITERION_FIRST in cram for a fresh card', () => {
		expect(toPlanCard(card(), 'keyterm', [], { ...cram, mode: 'longterm' }).required).toBe(
			CRITERION_FIRST_REDUCED
		);
		expect(toPlanCard(card(), 'keyterm', [], cram).required).toBe(CRITERION_FIRST);
	});

	it('reduces at the RELEARN_OVERRIDE_SESSIONS boundary of relearningSessionsAhead', () => {
		const at = (n: number) =>
			toPlanCard(card(), 'keyterm', [], { ...cram, relearningSessionsAhead: n }).required;
		expect(at(RELEARN_OVERRIDE_SESSIONS)).toBe(CRITERION_FIRST_REDUCED);
		expect(at(RELEARN_OVERRIDE_SESSIONS - 1)).toBe(CRITERION_FIRST);
	});

	it('reduces when its events show it was known on first try, but not after a pretest', () => {
		const known = events().review(S1, ok({ mode: 'acquisition', credited: false })).list;
		expect(toPlanCard(card({ status: 'learning' }), 'keyterm', known, cram).required).toBe(
			CRITERION_FIRST_REDUCED
		);
		const pretested = events()
			.pretest()
			.review(S1, ok({ mode: 'acquisition', credited: false }));
		expect(toPlanCard(card({ status: 'learning' }), 'keyterm', pretested.list, cram).required).toBe(
			CRITERION_FIRST
		);
	});

	it('needs CRITERION_LATER when the criterion was met before', () => {
		const met = events().pretest().review(S1, ok()).review(S1, ok()).review(S1, ok()).list;
		expect(toPlanCard(card({ status: 'exam-ready' }), 'keyterm', met, cram).required).toBe(
			CRITERION_LATER
		);
		expect(
			toPlanCard(card({ status: 'exam-ready' }), 'keyterm', met, {
				mode: 'longterm',
				relearningSessionsAhead: RELEARN_OVERRIDE_SESSIONS
			}).required
		).toBe(CRITERION_LATER);
	});

	it('sets firstEver only when the card has no review and no pretest', () => {
		expect(toPlanCard(card(), 'keyterm', [], cram).firstEver).toBe(true);
		expect(toPlanCard(card(), 'keyterm', events().selfRated().list, cram).firstEver).toBe(true);
		expect(toPlanCard(card(), 'keyterm', events().pretest().list, cram).firstEver).toBe(false);
		const reviewed = events().review(S1, no({ mode: 'acquisition', credited: false })).list;
		expect(toPlanCard(card({ status: 'learning' }), 'keyterm', reviewed, cram).firstEver).toBe(
			false
		);
		const warm = events().review(S1, ok({ kind: 'matching', weight: 'none' })).list;
		expect(toPlanCard(card({ status: 'learning' }), 'keyterm', warm, cram).firstEver).toBe(false);
	});

	it('shows the current path kind, skipping MC once accuracy reaches MC_UNTIL_ACCURACY', () => {
		const n = 100;
		const path: Card['path'] = ['mc', 'cloze'];
		const atRate = (correct: number) =>
			toPlanCard(card({ path, accuracy: { n, correct } }), 'keyterm', [], cram).kind;
		expect(atRate(Math.round(MC_UNTIL_ACCURACY * n))).toBe('cloze');
		expect(atRate(Math.round(MC_UNTIL_ACCURACY * n) - 1)).toBe('mc');
		expect(toPlanCard(card({ path, pathStep: 1 }), 'keyterm', [], cram).kind).toBe('cloze');
	});

	it('is new only when its status is unseen', () => {
		const statuses: CardStatus[] = [
			'unseen',
			'learning',
			'provisional',
			'needs-work',
			'exam-ready'
		];
		for (const status of statuses) {
			expect({
				status,
				isNew: toPlanCard(card({ status }), 'keyterm', [], cram).isNew
			}).toStrictEqual({ status, isNew: status === 'unseen' });
		}
	});
});
