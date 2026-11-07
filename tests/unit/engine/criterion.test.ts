import { describe, expect, it } from 'vitest';
import { CRITERION_FIRST, CRITERION_LATER } from '#lib/config/defaults.ts';
import type { CountableAnswer, CriterionState } from '#lib/engine/criterion.ts';
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

/** @see BUILD_PLAN §6.3 and Decisions log (required corrects) */
describe('requiredCorrects', () => {
	it('needs CRITERION_FIRST until the card has met the criterion in a credited session', () => {
		expect(requiredCorrects(false)).toBe(CRITERION_FIRST);
	});

	it('needs CRITERION_LATER once the criterion has been met', () => {
		expect(requiredCorrects(true)).toBe(CRITERION_LATER);
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
		expect(isCriterionMet(fold(answers, requiredCorrects(true)))).toBe(true);
	});

	it('a single MC correct does not meet CRITERION_LATER', () => {
		expect(isCriterionMet(fold([MC], requiredCorrects(true)))).toBe(false);
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
