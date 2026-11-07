import { describe, expect, it } from 'vitest';
import { CRITERION_FIRST, CRITERION_LATER } from '#lib/config/defaults.ts';
import type { ExerciseKind } from '#lib/db/schemas/common.ts';
import type { SessionPhase, SessionSnapshot } from '#lib/db/schemas/session.ts';
import { SessionSnapshotSchema } from '#lib/db/schemas/session.ts';
import { applyAnswer, currentItem } from '#lib/engine/queue.ts';
import type { PlanCard, PlanInput } from '#lib/engine/session.ts';
import {
	isSessionComplete,
	phaseFor,
	planSession,
	sessionPhase,
	startCleanup
} from '#lib/engine/session.ts';
import { cardId, deepFreeze, noteId } from './fixtures.ts';
import { at, cardOf, makeSnapshot, planCard, qa } from './session-fixtures.ts';

const plan = (cards: readonly PlanCard[], confusionEvents: PlanInput['confusionEvents'] = []) =>
	planSession({ cards, confusionEvents }).result;
const ids = (...ns: number[]) => ns.map(cardId);

/** BUILD_PLAN §3.3, by group, for a card that is not new. */
const KINDS_BY_PHASE: Record<Exclude<SessionPhase, 'cleanup'>, ExerciseKind[]> = {
	warmup: ['matching', 'hotspot', 'pretest'],
	new: ['exampleStudy', 'fadeStep'],
	discrimination: ['categorize', 'oddOneOut', 'whichOne', 'scenario', 'tableRow', 'pickPrinciple'],
	recall: [
		'cloze',
		'firstLetterType',
		'newInstance',
		'sequence',
		'parsons',
		'subgoalMatch',
		'occlusionType',
		'occlusionDrag',
		'structureRebuild',
		'layerOrder',
		'nodeCloze',
		'edgeCloze',
		'mc',
		'multiSelect',
		'occlusionBank',
		'firstLetterBank',
		'flip',
		'explainIt',
		'blurt',
		'redraw'
	]
};

/** @see BUILD_PLAN §6.4 and Decisions log (session phases) */
describe('phaseFor', () => {
	for (const [phase, kinds] of Object.entries(KINDS_BY_PHASE)) {
		for (const kind of kinds) {
			it(`puts a reviewed ${kind} card in ${phase}`, () => {
				expect(phaseFor(kind, false)).toBe(phase);
			});
		}
	}

	it('puts new recall and choose cards in new', () => {
		expect(phaseFor('cloze', true)).toBe('new');
		expect(phaseFor('mc', true)).toBe('new');
	});

	it('puts exampleStudy and fadeStep in new whether or not the card is new', () => {
		expect(phaseFor('exampleStudy', true)).toBe('new');
		expect(phaseFor('fadeStep', true)).toBe('new');
	});

	it('keeps warm-up kinds in warmup even for a new card', () => {
		// SPEC-GAP: does "warm-up kinds → warmup" win over "new cards → new"? Read as yes (listed first;
		// a pretest is by nature on a new card, and concept §6 puts pretests in the warm-up).
		expect(phaseFor('pretest', true)).toBe('warmup');
		expect(phaseFor('matching', true)).toBe('warmup');
	});

	it('puts a new Sort & discriminate card in new', () => {
		// SPEC-GAP: does "new cards → new" win over "Sort & discriminate → discrimination"? Read as yes
		// (listed first in the Decisions log row).
		expect(phaseFor('whichOne', true)).toBe('new');
	});
});

/** @see BUILD_PLAN §6.4, DATA_MODEL §3.7 and Decisions log (session phases, snapshot shape) */
describe('planSession: phases and card state', () => {
	it('orders phases warm-up → new → recall → discrimination', () => {
		const result = plan([
			planCard(1, 'cloze'),
			planCard(2, 'whichOne'),
			planCard(3, 'cloze', { isNew: true }),
			planCard(4, 'matching')
		]);
		expect(result.queue).toEqual(ids(4, 3, 1, 2));
	});

	it('gives every card a fresh SessionCard with its phase and required corrects', () => {
		const result = plan([
			planCard(1, 'cloze', { required: CRITERION_LATER }),
			planCard(2, 'cloze', { isNew: true, required: CRITERION_FIRST })
		]);
		expect(cardOf(result, cardId(1))).toEqual({
			phase: 'recall',
			required: CRITERION_LATER,
			count: 0,
			lastFull: false,
			failed: false,
			attempt: 0,
			done: false
		});
		expect(cardOf(result, cardId(2))).toMatchObject({ phase: 'new', required: CRITERION_FIRST });
	});

	it('starts with nothing being cleared and cleanup not started', () => {
		const result = plan([planCard(1, 'cloze')]);
		expect(result.clearing).toBeNull();
		expect(result.cleanup).toBe(false);
	});

	it('plans an empty session as an empty queue', () => {
		expect(plan([])).toEqual({ queue: [], cards: {}, clearing: null, cleanup: false });
	});

	it('keeps the first entry of a repeated card ID', () => {
		const result = plan([
			planCard(1, 'cloze', { required: CRITERION_LATER }),
			planCard(2, 'cloze'),
			planCard(1, 'mc', { isNew: true, required: CRITERION_FIRST })
		]);
		expect(result.queue).toEqual(ids(1, 2));
		expect(Object.keys(result.cards)).toHaveLength(2);
		expect(cardOf(result, cardId(1))).toMatchObject({ phase: 'recall', required: CRITERION_LATER });
	});
});

/** @see BUILD_PLAN §6.4, CONCEPT §6 and Decisions log (session phases: group by kind) */
describe('planSession: grouping by kind inside a phase', () => {
	it('groups recall cards by kind in §3.3 order, keeping input order within a kind', () => {
		const result = plan([
			planCard(1, 'mc'),
			planCard(2, 'cloze'),
			planCard(3, 'mc'),
			planCard(4, 'sequence'),
			planCard(5, 'cloze')
		]);
		expect(result.queue).toEqual(ids(2, 5, 4, 1, 3));
	});

	it('keeps input order, not ID order, for cards of one kind', () => {
		expect(plan([planCard(3, 'cloze'), planCard(1, 'cloze'), planCard(2, 'cloze')]).queue).toEqual(
			ids(3, 1, 2)
		);
	});

	it('puts worked examples first in the new phase', () => {
		// SPEC-GAP: where does fadeStep go relative to a new cloze — after worked examples as a "fade"
		// (concept §6) or at its §3.3 table position (after cloze)? Not tested here.
		const result = plan([
			planCard(1, 'cloze', { isNew: true }),
			planCard(2, 'exampleStudy'),
			planCard(3, 'cloze', { isNew: true })
		]);
		expect(result.queue).toEqual(ids(2, 1, 3));
	});

	it('groups warm-up cards in §3.3 order: matching, hotspot, pretest', () => {
		const result = plan([planCard(1, 'pretest'), planCard(2, 'hotspot'), planCard(3, 'matching')]);
		expect(result.queue).toEqual(ids(3, 2, 1));
	});

	it('does not move confusable cards together outside discrimination', () => {
		const result = plan(
			[planCard(1, 'cloze'), planCard(2, 'cloze'), planCard(3, 'cloze')],
			[{ cardId: cardId(1), chosenFromCardId: cardId(3) }]
		);
		expect(result.queue).toEqual(ids(1, 2, 3));
	});
});

/** @see BUILD_PLAN §6.4, CONCEPT §6 and Decisions log (discrimination chains confusables) */
describe('planSession: confusables adjacent in discrimination', () => {
	const adjacent = (queue: readonly string[], a: number, b: number) =>
		Math.abs(queue.indexOf(cardId(a)) - queue.indexOf(cardId(b))) === 1;
	const compare = (n: number, note: number): PlanCard =>
		planCard(n, 'whichOne', { noteId: noteId(note), noteType: 'compare' });

	it('places cards from the same compare note next to each other', () => {
		const result = plan([compare(1, 10), compare(2, 11), compare(3, 10)]);
		expect(adjacent(result.queue, 1, 3)).toBe(true);
		expect(result.queue).toEqual(ids(1, 3, 2));
	});

	it('does not treat a shared non-compare note as confusable', () => {
		const result = plan([
			planCard(1, 'whichOne', { noteId: noteId(10) }),
			planCard(2, 'whichOne', { noteId: noteId(11) }),
			planCard(3, 'whichOne', { noteId: noteId(10) })
		]);
		expect(result.queue).toEqual(ids(1, 2, 3));
	});

	it('places a logged confusion pair (chosenFromCardId) next to each other', () => {
		const cards = [planCard(1, 'whichOne'), planCard(2, 'whichOne'), planCard(3, 'whichOne')];
		const result = plan(cards, [{ cardId: cardId(3), chosenFromCardId: cardId(1) }]);
		expect(adjacent(result.queue, 1, 3)).toBe(true);
		expect(result.queue).toEqual(ids(1, 3, 2));
	});

	it('counts a confusion event in either direction', () => {
		// SPEC-GAP: is a confusion pair undirected? Read as yes (as confusionCounts in distractors).
		const cards = [planCard(1, 'whichOne'), planCard(2, 'whichOne'), planCard(3, 'whichOne')];
		const result = plan(cards, [{ cardId: cardId(1), chosenFromCardId: cardId(3) }]);
		expect(result.queue).toEqual(ids(1, 3, 2));
	});

	it('prefers the card with most confusion events over one with fewer', () => {
		const cards = [planCard(1, 'whichOne'), planCard(2, 'whichOne'), planCard(3, 'whichOne')];
		const result = plan(cards, [
			{ cardId: cardId(1), chosenFromCardId: cardId(2) },
			{ cardId: cardId(1), chosenFromCardId: cardId(3) },
			{ cardId: cardId(3), chosenFromCardId: cardId(1) }
		]);
		expect(result.queue).toEqual(ids(1, 3, 2));
	});

	it('prefers a logged confusion over a shared compare note', () => {
		const cards = [compare(1, 10), compare(2, 10), planCard(3, 'whichOne')];
		const result = plan(cards, [{ cardId: cardId(3), chosenFromCardId: cardId(1) }]);
		expect(result.queue).toEqual(ids(1, 3, 2));
	});

	it('ignores events without chosenFromCardId or naming cards outside the session', () => {
		const cards = [planCard(1, 'whichOne'), planCard(2, 'whichOne'), planCard(3, 'whichOne')];
		const result = plan(cards, [
			{ cardId: cardId(1) },
			{ cardId: cardId(1), chosenFromCardId: cardId(99) },
			{ cardId: cardId(99), chosenFromCardId: cardId(3) }
		]);
		expect(result.queue).toEqual(ids(1, 2, 3));
	});

	it('keeps discrimination after recall even when cards are confusable across phases', () => {
		const result = plan(
			[planCard(1, 'whichOne'), planCard(2, 'cloze')],
			[{ cardId: cardId(1), chosenFromCardId: cardId(2) }]
		);
		expect(result.queue).toEqual(ids(2, 1));
	});
});

/** @see DATA_MODEL §3.7, BUILD_PLAN §11.5 */
describe('planSession: purity, shape and determinism', () => {
	const input: PlanInput = {
		cards: [
			planCard(1, 'mc'),
			planCard(2, 'whichOne', { noteType: 'compare', noteId: noteId(10) }),
			planCard(3, 'cloze', { isNew: true, required: CRITERION_FIRST }),
			planCard(4, 'pretest'),
			planCard(5, 'whichOne', { noteType: 'compare', noteId: noteId(10) }),
			planCard(6, 'whichOne')
		],
		confusionEvents: [{ cardId: cardId(6), chosenFromCardId: cardId(2) }]
	};

	it('returns a snapshot that parses with SessionSnapshotSchema', () => {
		expect(() => SessionSnapshotSchema.parse(planSession(input).result)).not.toThrow();
	});

	it('does not mutate its input', () => {
		const frozen = deepFreeze(structuredClone(input));
		expect(() => planSession(frozen)).not.toThrow();
		expect(frozen).toEqual(input);
	});

	it('is deterministic: identical result and trace', () => {
		expect(planSession(input)).toEqual(planSession(input));
		expect(Array.isArray(planSession(input).trace)).toBe(true);
	});
});

/** @see CONCEPT §6 and Decisions log (session phases: cleanup) */
describe('startCleanup', () => {
	/** Main queue finished: 1, 3, 4 failed; 2 didn't. */
	function finished(): SessionSnapshot {
		const done = { done: true, count: CRITERION_FIRST, required: CRITERION_FIRST, lastFull: true };
		return makeSnapshot([], {
			[cardId(1)]: { ...done, failed: true, attempt: 6 },
			[cardId(2)]: { ...done, attempt: 3 },
			[cardId(3)]: { ...done, failed: true, attempt: 5 },
			[cardId(4)]: { ...done, failed: true, attempt: 7 }
		});
	}
	const R = { [cardId(1)]: 0.5, [cardId(2)]: 0.1, [cardId(3)]: 0.2, [cardId(4)]: 0.5 };

	it('brings back every failed card, lowest retrievability first, ties by card ID', () => {
		const { result } = startCleanup(finished(), R);
		expect(result.queue).toEqual(ids(3, 1, 4));
		expect(result.cleanup).toBe(true);
	});

	it('does not bring back cards that never failed', () => {
		expect(startCleanup(finished(), R).result.queue).not.toContain(cardId(2));
	});

	it('marks the returned cards not done and in the cleanup phase', () => {
		const { result } = startCleanup(finished(), R);
		for (const id of ids(1, 3, 4)) expect(cardOf(result, id).done).toBe(false);
		// SPEC-GAP: should returned cards get phase 'cleanup'? Read as yes, so sessionPhase and
		// currentItem report the cleanup phase while it runs.
		expect(sessionPhase(result)).toBe('cleanup');
		expect(currentItem(result)?.phase).toBe('cleanup');
		expect(currentItem(result)?.firstAttempt).toBe(true);
	});

	it('needs exactly one more counting full correct per returned card', () => {
		let state = startCleanup(finished(), R).result;
		for (const id of ids(3, 1, 4)) {
			expect(state.queue[0]).toBe(id);
			state = applyAnswer(state, qa(id, true)).result;
			expect(cardOf(state, id).done).toBe(true);
			expect(state.queue).not.toContain(id);
		}
		expect(isSessionComplete(state)).toBe(true);
	});

	it('keeps each card attempt counter running so seeds stay new', () => {
		const { result } = startCleanup(finished(), R);
		expect(cardOf(result, cardId(1)).attempt).toBeGreaterThanOrEqual(6);
	});

	it('sets cleanup with an empty queue when no card failed', () => {
		const state = makeSnapshot([], { [cardId(2)]: { done: true, count: 1 } });
		const { result } = startCleanup(state, R);
		expect(result.queue).toEqual([]);
		expect(result.cleanup).toBe(true);
		expect(isSessionComplete(result)).toBe(true);
	});

	it('returns the state unchanged while the main queue is not empty', () => {
		const state = makeSnapshot([cardId(2)], { [cardId(1)]: { done: true, failed: true } });
		expect(startCleanup(state, R).result).toEqual(state);
	});

	it('returns the state unchanged once cleanup has already run', () => {
		const state = { ...finished(), cleanup: true };
		expect(startCleanup(state, R).result).toEqual(state);
	});

	it('runs once: after the cleanup pass, calling it again changes nothing', () => {
		let state = startCleanup(finished(), R).result;
		while (state.queue.length > 0) state = applyAnswer(state, qa(at(state.queue, 0), true)).result;
		expect(startCleanup(state, R).result).toEqual(state);
	});

	it('returns a snapshot that parses, does not mutate its input, and is deterministic', () => {
		const input = finished();
		const frozen = deepFreeze(structuredClone(input));
		const first = startCleanup(frozen, R);
		expect(() => SessionSnapshotSchema.parse(first.result)).not.toThrow();
		expect(frozen).toEqual(input);
		expect(startCleanup(input, R)).toEqual(first);
		expect(Array.isArray(first.trace)).toBe(true);
	});
});

/** @see DATA_MODEL §3.7 */
describe('sessionPhase', () => {
	it('is the phase of the current card', () => {
		const state = makeSnapshot(ids(1, 2), {
			[cardId(1)]: { phase: 'discrimination' },
			[cardId(2)]: { phase: 'recall' }
		});
		expect(sessionPhase(state)).toBe('discrimination');
	});

	it('is cleanup when the queue is empty, before or after cleanup starts', () => {
		expect(sessionPhase(makeSnapshot([]))).toBe('cleanup');
		expect(sessionPhase(makeSnapshot([], {}, { cleanup: true }))).toBe('cleanup');
	});

	it('follows the queue across a planned session', () => {
		const state = plan([planCard(1, 'cloze'), planCard(2, 'matching')]);
		expect(sessionPhase(state)).toBe('warmup');
	});
});

/** @see BUILD_PLAN §6.4 */
describe('isSessionComplete', () => {
	it('is false while cards remain in the queue', () => {
		expect(isSessionComplete(makeSnapshot([cardId(1)], {}, { cleanup: true }))).toBe(false);
	});

	it('is false when the main queue is empty but cleanup has not run', () => {
		expect(isSessionComplete(makeSnapshot([]))).toBe(false);
	});

	it('is true when the queue is empty and cleanup has run', () => {
		expect(isSessionComplete(makeSnapshot([], {}, { cleanup: true }))).toBe(true);
	});
});

/** @see BUILD_PLAN §6.4, CONCEPT §5–6 */
describe('a short session from plan to completion', () => {
	it('plans, drills with a redo, cleans up the failed card and completes', () => {
		let s = plan([planCard(1, 'cloze'), planCard(2, 'cloze')]);
		expect(s.queue).toEqual(ids(1, 2));

		s = applyAnswer(s, qa(cardId(1), false)).result;
		expect(s.clearing).toBe(cardId(1));
		s = applyAnswer(s, qa(cardId(1), true)).result;
		expect(s.queue).toEqual(ids(2, 1));

		s = applyAnswer(s, qa(cardId(2), true)).result;
		s = applyAnswer(s, qa(cardId(1), true)).result;
		expect(s.queue).toEqual([]);
		expect(isSessionComplete(s)).toBe(false);

		s = startCleanup(s, { [cardId(1)]: 0.3, [cardId(2)]: 0.9 }).result;
		expect(s.queue).toEqual(ids(1));
		expect(sessionPhase(s)).toBe('cleanup');

		s = applyAnswer(s, qa(cardId(1), true)).result;
		expect(isSessionComplete(s)).toBe(true);
	});
});
