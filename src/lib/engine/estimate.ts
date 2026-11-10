import {
	P0,
	READ_WPM,
	SAFETY_MARGIN,
	SEC_PER_ATTEMPT,
	SEC_PER_ATTEMPT_DEFAULT
} from '#lib/config/defaults.ts';
import type { FsrsCardState } from '#lib/db/schemas/card.ts';
import type { ExerciseKind, Material } from '#lib/db/schemas/common.ts';
import type { NoteType } from '#lib/db/schemas/note.ts';
import { retrievabilityAt, type FsrsConfig } from './fsrs.ts';

/**
 * Workload estimates in minutes, shared by cram, acquisition, one-night and (Phase 8) the planner.
 *
 * @see BUILD_PLAN §6.9 (workload estimate) and Decisions log (Phase 7: estimator)
 */

/** Where a card stands for an exam: survives unaided, needs work, or never reviewed. */
export type Standing = 'new' | 'at-risk' | 'secure';

/** The user's measured values; a missing key uses the default. @see DATA_MODEL §5 `calibration` */
export interface Calibration {
	secPerAttempt: Partial<Record<ExerciseKind, number>>;
	p0: Partial<Record<Material, number>>;
}

export const EMPTY_CALIBRATION: Calibration = { secPerAttempt: {}, p0: {} };

/** What the estimator needs of a card. */
export interface EstimateCard {
	kind: ExerciseKind;
	noteType: NoteType;
	fsrs: FsrsCardState | null;
}

/** The context of one estimate. */
export interface EstimateContext {
	/** Corrects a new card needs in its first session (k). */
	criterion: number;
	/** Relearning sessions per card (K). */
	relearnSessions: number;
	/** When the card would be reviewed, for `R(t)`. */
	at: number;
	calibration: Calibration;
	fsrs: FsrsConfig;
}

const MATERIAL_OF: Readonly<Record<NoteType, Material>> = {
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

const SECONDS_PER_MINUTE = 60;

/** The material type of a note type, for `p0`. @see DATA_MODEL §4.1 */
export function materialOf(noteType: NoteType): Material {
	return MATERIAL_OF[noteType];
}

function defaultSeconds(kind: ExerciseKind): number {
	const table: Partial<Record<ExerciseKind, number>> = SEC_PER_ATTEMPT;
	return table[kind] ?? SEC_PER_ATTEMPT_DEFAULT;
}

/** Seconds per attempt of a kind: calibration, else `SEC_PER_ATTEMPT`, else the default. */
export function secondsPerAttempt(kind: ExerciseKind, calibration: Calibration): number {
	return calibration.secPerAttempt[kind] ?? defaultSeconds(kind);
}

/** First-attempt accuracy of a new card of this note type: calibration `p0`, else `P0`. */
export function p0For(noteType: NoteType, calibration: Calibration): number {
	const material = materialOf(noteType);
	return calibration.p0[material] ?? P0[material];
}

/** Predicted recall at `at`, floored at the card's `p0`. */
export function recallFor(
	card: EstimateCard,
	at: number,
	calibration: Calibration,
	fsrs: FsrsConfig
): number {
	const p0 = p0For(card.noteType, calibration);
	if (card.fsrs === null) return p0;
	return Math.max(p0, retrievabilityAt(card.fsrs, at, fsrs));
}

/**
 * Attempts a card needs (§6.9): new `k / p0 + K / p_relearn` (p_relearn = p0), at-risk
 * `K / R(at)`, secure `1 / R(at)`. R is floored at `p0` so a near-forgotten card stays finite.
 */
export function cardAttempts(
	card: EstimateCard,
	standing: Standing,
	context: EstimateContext
): number {
	const p0 = p0For(card.noteType, context.calibration);
	switch (standing) {
		case 'new':
			return context.criterion / p0 + context.relearnSessions / p0;
		case 'at-risk':
			return (
				context.relearnSessions / recallFor(card, context.at, context.calibration, context.fsrs)
			);
		case 'secure':
			return 1 / recallFor(card, context.at, context.calibration, context.fsrs);
	}
}

/** Minutes for a card: attempts × seconds per attempt / 60 (no safety margin). */
export function cardMinutes(
	card: EstimateCard,
	standing: Standing,
	context: EstimateContext
): number {
	const seconds = secondsPerAttempt(card.kind, context.calibration);
	return (cardAttempts(card, standing, context) * seconds) / SECONDS_PER_MINUTE;
}

/** Minutes for a number of attempts of a kind. */
export function attemptMinutes(
	attempts: number,
	kind: ExerciseKind,
	calibration: Calibration
): number {
	return (attempts * secondsPerAttempt(kind, calibration)) / SECONDS_PER_MINUTE;
}

/** Reading minutes of a chunk: words / `READ_WPM`. */
export function readMinutes(words: number): number {
	return words / READ_WPM;
}

/** A total with the safety margin applied: Σ minutes × `SAFETY_MARGIN`. */
export function withMargin(minutes: number): number {
	return minutes * SAFETY_MARGIN;
}
