import { describe, expect, it } from 'vitest';
import {
	CRITERION_FIRST,
	CRITERION_FIRST_DEGRADED,
	P0,
	READ_WPM,
	RELEARN_SESSIONS_MAX,
	SAFETY_MARGIN,
	SEC_PER_ATTEMPT,
	SEC_PER_ATTEMPT_DEFAULT
} from '#lib/config/defaults.ts';
import type { ExerciseKind, Material } from '#lib/db/schemas/common.ts';
import type { NoteType } from '#lib/db/schemas/note.ts';
import {
	cardAttempts,
	cardMinutes,
	EMPTY_CALIBRATION,
	materialOf,
	p0For,
	readMinutes,
	secondsPerAttempt,
	withMargin,
	type EstimateCard,
	type EstimateContext
} from '#lib/engine/estimate.ts';
import { DEFAULT_FSRS_CONFIG, retrievabilityAt } from '#lib/engine/fsrs.ts';
import { AT_RISK, FORGOTTEN, NOW, SECURE } from './cram-fixtures.ts';

/** @see BUILD_PLAN §6.9 (workload estimate), DATA_MODEL §4.1, Decisions log (Phase 7: estimator) */

const MATERIAL: Record<NoteType, Material> = {
	keyterm: 'fact',
	fact: 'fact',
	cloze: 'concept',
	sequence: 'procedure',
	example: 'procedure',
	compare: 'comparison',
	scenario: 'comparison',
	diagram: 'diagram',
	occlusion: 'diagram'
};

/** Kinds whose `SEC_PER_ATTEMPT` key has the same name. */
const NAMED_KINDS = [
	'mc',
	'cloze',
	'sequence',
	'parsons',
	'categorize',
	'scenario',
	'tableRow',
	'fadeStep',
	'newInstance',
	'structureRebuild'
] as const satisfies readonly (ExerciseKind & keyof typeof SEC_PER_ATTEMPT)[];

const context = (overrides: Partial<EstimateContext> = {}): EstimateContext => ({
	criterion: CRITERION_FIRST,
	relearnSessions: RELEARN_SESSIONS_MAX,
	at: NOW,
	calibration: EMPTY_CALIBRATION,
	fsrs: DEFAULT_FSRS_CONFIG,
	...overrides
});
const card = (overrides: Partial<EstimateCard> = {}): EstimateCard => ({
	kind: 'cloze',
	noteType: 'keyterm',
	fsrs: null,
	...overrides
});

describe('materialOf', () => {
	for (const [noteType, material] of Object.entries(MATERIAL)) {
		it(`maps note type ${noteType} to material ${material} (DATA_MODEL §4.1)`, () => {
			expect(materialOf(noteType as NoteType)).toBe(material);
		});
	}
});

describe('secondsPerAttempt', () => {
	for (const kind of NAMED_KINDS) {
		it(`uses SEC_PER_ATTEMPT.${kind} for kind ${kind} with no calibration`, () => {
			expect(secondsPerAttempt(kind, EMPTY_CALIBRATION)).toBe(SEC_PER_ATTEMPT[kind]);
		});
	}

	it('falls back to SEC_PER_ATTEMPT_DEFAULT for a kind with no SEC_PER_ATTEMPT entry', () => {
		expect(secondsPerAttempt('whichOne', EMPTY_CALIBRATION)).toBe(SEC_PER_ATTEMPT_DEFAULT);
	});

	it('uses the calibrated value over SEC_PER_ATTEMPT', () => {
		const calibration = { ...EMPTY_CALIBRATION, secPerAttempt: { mc: 41 } };
		expect(secondsPerAttempt('mc', calibration)).toBe(41);
	});

	it('uses the calibrated value over SEC_PER_ATTEMPT_DEFAULT', () => {
		const calibration = { ...EMPTY_CALIBRATION, secPerAttempt: { whichOne: 7 } };
		expect(secondsPerAttempt('whichOne', calibration)).toBe(7);
	});

	it('ignores calibration for other kinds', () => {
		const calibration = { ...EMPTY_CALIBRATION, secPerAttempt: { cloze: 99 } };
		expect(secondsPerAttempt('mc', calibration)).toBe(SEC_PER_ATTEMPT.mc);
	});
});

describe('p0For', () => {
	for (const [noteType, material] of Object.entries(MATERIAL)) {
		it(`uses P0.${material} for a ${noteType} note with no calibration`, () => {
			expect(p0For(noteType as NoteType, EMPTY_CALIBRATION)).toBe(P0[material]);
		});
	}

	it('uses the calibrated p0 of the note type material', () => {
		const calibration = { ...EMPTY_CALIBRATION, p0: { fact: 0.8 } };
		expect(p0For('keyterm', calibration)).toBe(0.8);
		expect(p0For('fact', calibration)).toBe(0.8);
		expect(p0For('cloze', calibration)).toBe(P0.concept);
	});
});

describe('cardAttempts', () => {
	it('gives a new card k / p0 + K / p_relearn attempts, with p_relearn = p0', () => {
		const expected = CRITERION_FIRST / P0.fact + RELEARN_SESSIONS_MAX / P0.fact;
		expect(cardAttempts(card(), 'new', context())).toBeCloseTo(expected, 9);
	});

	it('uses the degraded criterion k when the context says so', () => {
		const ctx = context({ criterion: CRITERION_FIRST_DEGRADED });
		const expected = CRITERION_FIRST_DEGRADED / P0.fact + RELEARN_SESSIONS_MAX / P0.fact;
		expect(cardAttempts(card(), 'new', ctx)).toBeCloseTo(expected, 9);
	});

	it('uses the calibrated p0 for both terms of a new card', () => {
		const ctx = context({ calibration: { ...EMPTY_CALIBRATION, p0: { procedure: 0.6 } } });
		const expected = CRITERION_FIRST / 0.6 + RELEARN_SESSIONS_MAX / 0.6;
		expect(cardAttempts(card({ noteType: 'example' }), 'new', ctx)).toBeCloseTo(expected, 9);
	});

	it('gives an at-risk card K / R(at) attempts', () => {
		const at = NOW + 86_400_000;
		const r = retrievabilityAt(AT_RISK, at, DEFAULT_FSRS_CONFIG);
		expect(r).toBeGreaterThan(P0.fact);
		const attempts = cardAttempts(card({ fsrs: AT_RISK }), 'at-risk', context({ at }));
		expect(attempts).toBeCloseTo(RELEARN_SESSIONS_MAX / r, 9);
	});

	it('gives a secure card 1 / R(at) attempts (final pass only)', () => {
		const r = retrievabilityAt(SECURE, NOW, DEFAULT_FSRS_CONFIG);
		expect(cardAttempts(card({ fsrs: SECURE }), 'secure', context())).toBeCloseTo(1 / r, 9);
	});

	it('scales an at-risk card with K', () => {
		const r = retrievabilityAt(AT_RISK, NOW, DEFAULT_FSRS_CONFIG);
		const attempts = cardAttempts(
			card({ fsrs: AT_RISK }),
			'at-risk',
			context({ relearnSessions: 1 })
		);
		expect(attempts).toBeCloseTo(1 / r, 9);
	});

	it('floors R at p0, so a near-forgotten at-risk card stays finite', () => {
		expect(retrievabilityAt(FORGOTTEN, NOW, DEFAULT_FSRS_CONFIG)).toBeLessThan(P0.fact);
		const attempts = cardAttempts(card({ fsrs: FORGOTTEN }), 'at-risk', context());
		expect(attempts).toBeCloseTo(RELEARN_SESSIONS_MAX / P0.fact, 9);
	});

	it('floors R at p0 for a secure-standing card too', () => {
		const attempts = cardAttempts(card({ fsrs: FORGOTTEN }), 'secure', context());
		expect(attempts).toBeCloseTo(1 / P0.fact, 9);
	});

	it('floors R at the calibrated p0', () => {
		// SPEC-GAP: "R is floored at p0": read as the card's p0 from p0For (calibration first).
		const ctx = context({ calibration: { ...EMPTY_CALIBRATION, p0: { fact: 0.7 } } });
		expect(cardAttempts(card({ fsrs: FORGOTTEN }), 'secure', ctx)).toBeCloseTo(1 / 0.7, 9);
	});
});

describe('cardMinutes', () => {
	it('is attempts × seconds per attempt of the card kind / 60, with no safety margin', () => {
		const c = card({ kind: 'sequence', noteType: 'sequence' });
		const expected = (cardAttempts(c, 'new', context()) * SEC_PER_ATTEMPT.sequence) / 60;
		expect(cardMinutes(c, 'new', context())).toBeCloseTo(expected, 9);
	});

	it('uses the calibrated seconds per attempt', () => {
		const ctx = context({ calibration: { ...EMPTY_CALIBRATION, secPerAttempt: { cloze: 30 } } });
		const c = card({ fsrs: SECURE });
		expect(cardMinutes(c, 'secure', ctx)).toBeCloseTo(
			(cardAttempts(c, 'secure', ctx) * 30) / 60,
			9
		);
	});

	it('uses SEC_PER_ATTEMPT_DEFAULT for a kind with no entry', () => {
		const c = card({ kind: 'whichOne', fsrs: SECURE });
		const expected = (cardAttempts(c, 'secure', context()) * SEC_PER_ATTEMPT_DEFAULT) / 60;
		expect(cardMinutes(c, 'secure', context())).toBeCloseTo(expected, 9);
	});
});

describe('readMinutes and withMargin', () => {
	it('reads words at READ_WPM', () => {
		expect(readMinutes(READ_WPM * 2)).toBeCloseTo(2, 9);
		expect(readMinutes(300)).toBeCloseTo(300 / READ_WPM, 9);
	});

	it('takes no time for no words', () => {
		expect(readMinutes(0)).toBe(0);
	});

	it('applies SAFETY_MARGIN to a total', () => {
		expect(withMargin(10)).toBeCloseTo(10 * SAFETY_MARGIN, 9);
		expect(withMargin(0)).toBe(0);
	});
});
