import { describe, expect, it } from 'vitest';
import {
	CRITERION_FIRST,
	CRITERION_FIRST_REDUCED,
	CRITERION_LATER,
	RELEARN_OVERRIDE_SESSIONS
} from '#lib/config/defaults.ts';
import type { Mode } from '#lib/db/schemas/common.ts';
import type { CountableAnswer, CriterionContext, CriterionState } from '#lib/engine/criterion.ts';
import {
	criterionForSession,
	isCounting,
	isCriterionMet,
	requiredCorrects,
	startCriterion,
	stepCriterion
} from '#lib/engine/criterion.ts';
import { deepFreeze } from './fixtures.ts';
import { ca } from './session-fixtures.ts';

const fold = (answers: readonly CountableAnswer[], required: number): CriterionState =>
	answers.reduce(stepCriterion, startCriterion(required));

/** A first-session context with nothing that reduces the criterion: cram, no relearning, not known. */
const ctx = (overrides: Partial<CriterionContext> = {}): CriterionContext => ({
	hasMetCriterion: false,
	knownOnFirstTry: false,
	mode: 'cram',
	relearningSessionsAhead: 0,
	...overrides
});
const LATER = ctx({ hasMetCriterion: true });

const MC = ca({ weight: 'recognition' });
const FULL = ca();
const WRONG = ca({ correct: false });

/** @see BUILD_PLAN §6.3 and Decisions log (counting event) */
describe('isCounting', () => {
	it('counts a credited first attempt with full weight', () => {
		expect(isCounting({ firstAttempt: true, credited: true, weight: 'full' })).toBe(true);
	});

	it('counts a credited first attempt with recognition weight', () => {
		expect(isCounting({ firstAttempt: true, credited: true, weight: 'recognition' })).toBe(true);
	});

	it('never counts none-weight answers', () => {
		expect(isCounting({ firstAttempt: true, credited: true, weight: 'none' })).toBe(false);
	});

	it('does not count a redo attempt (firstAttempt false)', () => {
		expect(isCounting({ firstAttempt: false, credited: true, weight: 'full' })).toBe(false);
	});

	it('does not count an uncredited answer', () => {
		expect(isCounting({ firstAttempt: true, credited: false, weight: 'full' })).toBe(false);
	});
});

/** @see BUILD_PLAN §6.3 and Decisions log (required corrects, adaptive first-session criterion) */
describe('requiredCorrects', () => {
	it('needs CRITERION_FIRST until the card has met the criterion in a credited session', () => {
		expect(requiredCorrects(ctx())).toBe(CRITERION_FIRST);
	});

	it('needs CRITERION_LATER once the criterion has been met', () => {
		expect(requiredCorrects(LATER)).toBe(CRITERION_LATER);
	});

	it('reduces the first session to CRITERION_FIRST_REDUCED in longterm mode', () => {
		expect(requiredCorrects(ctx({ mode: 'longterm' }))).toBe(CRITERION_FIRST_REDUCED);
	});

	const nonLongterm: Mode[] = ['cram', 'onenight', 'acquisition'];
	for (const mode of nonLongterm) {
		it(`does not reduce the first session for ${mode} mode alone`, () => {
			expect(requiredCorrects(ctx({ mode }))).toBe(CRITERION_FIRST);
		});
	}

	it('does not reduce with RELEARN_OVERRIDE_SESSIONS − 1 relearning sessions ahead', () => {
		const context = ctx({ relearningSessionsAhead: RELEARN_OVERRIDE_SESSIONS - 1 });
		expect(requiredCorrects(context)).toBe(CRITERION_FIRST);
	});

	it('reduces with exactly RELEARN_OVERRIDE_SESSIONS relearning sessions ahead', () => {
		const context = ctx({ relearningSessionsAhead: RELEARN_OVERRIDE_SESSIONS });
		expect(requiredCorrects(context)).toBe(CRITERION_FIRST_REDUCED);
	});

	it('reduces with more than RELEARN_OVERRIDE_SESSIONS relearning sessions ahead', () => {
		const context = ctx({ relearningSessionsAhead: RELEARN_OVERRIDE_SESSIONS + 2 });
		expect(requiredCorrects(context)).toBe(CRITERION_FIRST_REDUCED);
	});

	it('reduces when the card was known on first try', () => {
		expect(requiredCorrects(ctx({ knownOnFirstTry: true }))).toBe(CRITERION_FIRST_REDUCED);
	});

	it('reduces only once when several reasons hold (never below CRITERION_FIRST_REDUCED)', () => {
		const context = ctx({
			mode: 'longterm',
			knownOnFirstTry: true,
			relearningSessionsAhead: RELEARN_OVERRIDE_SESSIONS
		});
		expect(requiredCorrects(context)).toBe(CRITERION_FIRST_REDUCED);
	});

	const reasons: [string, Partial<CriterionContext>][] = [
		['nothing else', {}],
		['longterm mode', { mode: 'longterm' }],
		['enough relearning sessions', { relearningSessionsAhead: RELEARN_OVERRIDE_SESSIONS }],
		['known on first try', { knownOnFirstTry: true }],
		[
			'every reduction at once',
			{
				mode: 'longterm',
				knownOnFirstTry: true,
				relearningSessionsAhead: RELEARN_OVERRIDE_SESSIONS
			}
		]
	];
	for (const [label, overrides] of reasons) {
		it(`CRITERION_LATER wins once the criterion was met, with ${label}`, () => {
			expect(requiredCorrects(ctx({ ...overrides, hasMetCriterion: true }))).toBe(CRITERION_LATER);
		});
	}

	it('is deterministic and does not mutate its context', () => {
		const context = deepFreeze(ctx({ mode: 'longterm' }));
		expect(requiredCorrects(context)).toBe(requiredCorrects(context));
	});
});

/** @see BUILD_PLAN §6.3 */
describe('startCriterion', () => {
	it('starts with no count, not failed, and the given requirement', () => {
		expect(startCriterion(CRITERION_FIRST)).toEqual({
			required: CRITERION_FIRST,
			count: 0,
			lastFull: false,
			failed: false
		});
	});

	it('is not met at the start', () => {
		expect(isCriterionMet(startCriterion(CRITERION_LATER))).toBe(false);
	});
});

/** @see BUILD_PLAN §6.3 and Decisions log (counting event) */
describe('stepCriterion', () => {
	it('adds one and records full weight on a counting full correct', () => {
		const next = stepCriterion(startCriterion(CRITERION_FIRST), FULL);
		expect(next).toEqual({ required: CRITERION_FIRST, count: 1, lastFull: true, failed: false });
	});

	it('adds one and records non-full weight on a counting recognition correct', () => {
		const start = stepCriterion(startCriterion(CRITERION_FIRST), FULL);
		const next = stepCriterion(start, MC);
		expect(next).toEqual({ required: CRITERION_FIRST, count: 2, lastFull: false, failed: false });
	});

	it('resets the count to 0 and marks the card failed on a counting wrong answer', () => {
		const state = fold([FULL, FULL], CRITERION_FIRST);
		const next = stepCriterion(state, WRONG);
		expect(next.count).toBe(0);
		expect(next.failed).toBe(true);
		expect(next.required).toBe(CRITERION_FIRST);
	});

	it('resets on a wrong recognition answer too', () => {
		const next = stepCriterion(
			fold([FULL], CRITERION_FIRST),
			ca({ weight: 'recognition', correct: false })
		);
		expect(next.count).toBe(0);
		expect(next.failed).toBe(true);
	});

	it('keeps failed after a later correct', () => {
		const state = fold([WRONG, FULL], CRITERION_FIRST);
		expect(state.failed).toBe(true);
		expect(state.count).toBe(1);
	});

	const nonCounting: [string, CountableAnswer][] = [
		['a none-weight correct', ca({ weight: 'none' })],
		['a none-weight wrong', ca({ weight: 'none', correct: false })],
		['a redo correct', ca({ firstAttempt: false })],
		['a redo wrong', ca({ firstAttempt: false, correct: false })],
		['an uncredited correct', ca({ credited: false })],
		['an uncredited wrong', ca({ credited: false, correct: false })]
	];

	for (const [label, answer] of nonCounting) {
		it(`leaves the state unchanged for ${label}`, () => {
			const state = deepFreeze(fold([FULL, MC], CRITERION_FIRST));
			expect(stepCriterion(state, answer)).toEqual(state);
		});
	}

	it('does not mutate its input state', () => {
		const state = deepFreeze(startCriterion(CRITERION_FIRST));
		expect(() => stepCriterion(state, FULL)).not.toThrow();
		expect(() => stepCriterion(state, WRONG)).not.toThrow();
	});
});

/** @see BUILD_PLAN §6.3 (recall-weighted) and CONCEPT §5 */
describe('isCriterionMet', () => {
	it('is met after CRITERION_FIRST full corrects', () => {
		const answers = Array.from({ length: CRITERION_FIRST }, () => FULL);
		expect(isCriterionMet(fold(answers, CRITERION_FIRST))).toBe(true);
	});

	it('is not met one correct short of CRITERION_FIRST', () => {
		const answers = Array.from({ length: CRITERION_FIRST - 1 }, () => FULL);
		expect(isCriterionMet(fold(answers, CRITERION_FIRST))).toBe(false);
	});

	it('is not met by an MC-only streak of any length', () => {
		const answers = Array.from({ length: CRITERION_FIRST + 3 }, () => MC);
		const state = fold(answers, CRITERION_FIRST);
		expect(state.count).toBe(CRITERION_FIRST + 3);
		expect(isCriterionMet(state)).toBe(false);
	});

	it('is met when MC corrects are followed by a final full correct', () => {
		const answers = [...Array.from({ length: CRITERION_FIRST - 1 }, () => MC), FULL];
		expect(isCriterionMet(fold(answers, CRITERION_FIRST))).toBe(true);
	});

	it('is not met when the last counting correct is recognition, even after full ones', () => {
		const answers = [...Array.from({ length: CRITERION_FIRST - 1 }, () => FULL), MC];
		expect(isCriterionMet(fold(answers, CRITERION_FIRST))).toBe(false);
	});

	it('is met once a full correct follows a recognition-final streak past the requirement', () => {
		const answers = [...Array.from({ length: CRITERION_FIRST }, () => MC), FULL];
		const state = fold(answers, CRITERION_FIRST);
		expect(state.count).toBe(CRITERION_FIRST + 1);
		expect(isCriterionMet(state)).toBe(true);
	});

	it('ignores a non-counting answer after the last counting correct for the full-final rule', () => {
		const answers = [
			FULL,
			ca({ weight: 'none' }),
			ca({ firstAttempt: false, weight: 'recognition' })
		];
		expect(isCriterionMet(fold(answers, CRITERION_LATER))).toBe(true);
	});

	it('is not met after a wrong answer resets an otherwise complete streak', () => {
		const answers = [...Array.from({ length: CRITERION_FIRST - 1 }, () => FULL), WRONG, FULL];
		expect(isCriterionMet(fold(answers, CRITERION_FIRST))).toBe(false);
	});

	it('needs only CRITERION_LATER full corrects in a later session', () => {
		const answers = Array.from({ length: CRITERION_LATER }, () => FULL);
		expect(isCriterionMet(fold(answers, requiredCorrects(LATER)))).toBe(true);
	});

	it('a single MC correct does not meet CRITERION_LATER', () => {
		expect(isCriterionMet(fold([MC], requiredCorrects(LATER)))).toBe(false);
	});

	it('is met after CRITERION_FIRST_REDUCED full corrects when the first session is reduced', () => {
		const required = requiredCorrects(ctx({ mode: 'longterm' }));
		const answers = Array.from({ length: CRITERION_FIRST_REDUCED }, () => FULL);
		expect(isCriterionMet(fold(answers, required))).toBe(true);
		expect(isCriterionMet(fold(answers.slice(1), required))).toBe(false);
	});

	it('a reduced first session still needs a full-weight final correct', () => {
		const required = requiredCorrects(ctx({ knownOnFirstTry: true }));
		const answers = Array.from({ length: CRITERION_FIRST_REDUCED }, () => MC);
		expect(isCriterionMet(fold(answers, required))).toBe(false);
	});

	it('uncredited full corrects never meet the criterion', () => {
		const answers = Array.from({ length: CRITERION_FIRST }, () => ca({ credited: false }));
		expect(isCriterionMet(fold(answers, CRITERION_FIRST))).toBe(false);
	});
});

/** @see BUILD_PLAN §6.3 */
describe('criterionForSession', () => {
	it('folds the answers in order into the final state', () => {
		const answers = [FULL, WRONG, MC];
		const { result } = criterionForSession(answers, CRITERION_FIRST);
		expect(result.required).toBe(CRITERION_FIRST);
		expect(result.count).toBe(1);
		expect(result.lastFull).toBe(false);
		expect(result.failed).toBe(true);
		expect(result.met).toBe(false);
	});

	it('reports met when the criterion is met at the end', () => {
		const answers = Array.from({ length: CRITERION_FIRST }, () => FULL);
		expect(criterionForSession(answers, CRITERION_FIRST).result.met).toBe(true);
	});

	it('reports met when the criterion was met at some point, even if a later wrong reset it', () => {
		const answers = [...Array.from({ length: CRITERION_FIRST }, () => FULL), WRONG];
		const { result } = criterionForSession(answers, CRITERION_FIRST);
		expect(result.met).toBe(true);
		expect(result.count).toBe(0);
		expect(result.failed).toBe(true);
	});

	it('reports not met for an MC-only session', () => {
		const answers = Array.from({ length: CRITERION_FIRST * 2 }, () => MC);
		expect(criterionForSession(answers, CRITERION_FIRST).result.met).toBe(false);
	});

	it('reports not met and the start state for no answers', () => {
		const { result } = criterionForSession([], CRITERION_FIRST);
		expect(result).toEqual({ ...startCriterion(CRITERION_FIRST), met: false });
	});

	it('skips non-counting answers between counting ones', () => {
		const answers = [
			FULL,
			ca({ weight: 'none', correct: false }),
			ca({ firstAttempt: false, correct: false }),
			ca({ credited: false, correct: false }),
			FULL,
			FULL
		];
		const { result } = criterionForSession(answers, CRITERION_FIRST);
		expect(result.failed).toBe(false);
		expect(result.count).toBe(CRITERION_FIRST);
		expect(result.met).toBe(true);
	});

	it('returns a trace array', () => {
		const { trace } = criterionForSession([FULL], CRITERION_LATER);
		expect(Array.isArray(trace)).toBe(true);
	});

	it('is deterministic: same answers give identical result and trace', () => {
		const answers = deepFreeze([MC, WRONG, FULL, FULL, MC, FULL]);
		expect(criterionForSession(answers, CRITERION_FIRST)).toEqual(
			criterionForSession(answers, CRITERION_FIRST)
		);
	});
});
