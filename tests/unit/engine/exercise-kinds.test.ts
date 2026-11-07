import { describe, expect, it } from 'vitest';
import { MC_UNTIL_ACCURACY } from '#lib/config/defaults.ts';
import { ExerciseKindSchema, type ExerciseKind } from '#lib/db/schemas/common.ts';
import {
	advancePathStep,
	currentKind,
	currentStep,
	EXERCISES,
	groupOf,
	PHASE_KIND_ORDER,
	weightOf
} from '#lib/engine/exercise-kinds.ts';

const ALL_KINDS = ExerciseKindSchema.options;
const NONE = { n: 0, correct: 0 };
/** Accuracy exactly at the MC threshold, out of 100 attempts. */
const AT_THRESHOLD = { n: 100, correct: Math.round(MC_UNTIL_ACCURACY * 100) };
const BELOW_THRESHOLD = { n: 100, correct: AT_THRESHOLD.correct - 1 };

describe('EXERCISES (BUILD_PLAN §3.3)', () => {
	it('covers every exercise kind exactly once', () => {
		expect(Object.keys(EXERCISES).sort()).toStrictEqual([...ALL_KINDS].sort());
	});

	it.each([
		['cloze', 'recall', 'full'],
		['newInstance', 'recall', 'full'],
		['parsons', 'arrange', 'full'],
		['edgeCloze', 'arrange', 'full'],
		['tableRow', 'discriminate', 'full'],
		['pickPrinciple', 'discriminate', 'full'],
		['mc', 'choose', 'recognition'],
		['firstLetterBank', 'choose', 'recognition'],
		['matching', 'warmup', 'none'],
		['pretest', 'warmup', 'none'],
		['flip', 'selfRated', 'none'],
		['exampleStudy', 'selfRated', 'none']
	] as const)('%s is %s with weight %s', (kind, group, weight) => {
		expect(groupOf(kind)).toBe(group);
		expect(weightOf(kind)).toBe(weight);
	});
});

describe('PHASE_KIND_ORDER', () => {
	it('lists every kind once, worked examples first', () => {
		expect([...PHASE_KIND_ORDER].sort()).toStrictEqual([...ALL_KINDS].sort());
		expect(PHASE_KIND_ORDER.slice(0, 2)).toStrictEqual(['exampleStudy', 'fadeStep']);
	});
});

describe('currentKind', () => {
	const mcThenCloze: ExerciseKind[] = ['mc', 'cloze'];

	it('offers mc while accuracy is below MC_UNTIL_ACCURACY', () => {
		expect(currentKind(mcThenCloze, 0, NONE)).toBe('mc');
		expect(currentKind(mcThenCloze, 0, BELOW_THRESHOLD)).toBe('mc');
	});

	it('skips mc and occlusionBank once accuracy reaches the threshold', () => {
		expect(currentKind(mcThenCloze, 0, AT_THRESHOLD)).toBe('cloze');
		expect(currentKind(['occlusionBank', 'occlusionType'], 0, AT_THRESHOLD)).toBe('occlusionType');
	});

	it('never skips the last step', () => {
		expect(currentKind(['mc'], 0, AT_THRESHOLD)).toBe('mc');
	});

	it('does not skip other kinds', () => {
		expect(currentKind(['whichOne', 'cloze'], 0, AT_THRESHOLD)).toBe('whichOne');
	});

	it('clamps an out-of-range step to the path', () => {
		expect(currentKind(mcThenCloze, 5, NONE)).toBe('cloze');
	});
});

describe('currentStep', () => {
	it('is the index currentKind reads, past gated choose steps', () => {
		expect(currentStep(['mc', 'cloze'], 0, NONE)).toBe(0);
		expect(currentStep(['mc', 'cloze'], 0, AT_THRESHOLD)).toBe(1);
		expect(currentStep(['exampleStudy', 'fadeStep', 'fadeStep'], 2, NONE)).toBe(2);
	});

	it('clamps below 0 and past the end', () => {
		expect(currentStep(['mc', 'cloze'], -3, NONE)).toBe(0);
		expect(currentStep(['mc', 'cloze'], 9, NONE)).toBe(1);
	});
});

describe('advancePathStep', () => {
	const example: ExerciseKind[] = ['exampleStudy', 'fadeStep', 'fadeStep', 'newInstance'];

	it('moves one past the completed step', () => {
		expect(advancePathStep(example, 0, 'exampleStudy')).toBe(1);
		expect(advancePathStep(example, 1, 'fadeStep')).toBe(2);
		expect(advancePathStep(example, 2, 'fadeStep')).toBe(3);
	});

	it('moves past a skipped mc step when the later kind is completed', () => {
		expect(advancePathStep(['mc', 'cloze'], 0, 'cloze')).toBe(1);
	});

	it('clamps at the last step', () => {
		expect(advancePathStep(example, 3, 'newInstance')).toBe(3);
		expect(advancePathStep(['scenario'], 0, 'scenario')).toBe(0);
	});

	it('never moves back for a kind earlier in the path', () => {
		expect(advancePathStep(example, 3, 'exampleStudy')).toBe(3);
	});

	it('leaves the step for a kind not in the path', () => {
		expect(advancePathStep(example, 1, 'mc')).toBe(1);
	});
});
