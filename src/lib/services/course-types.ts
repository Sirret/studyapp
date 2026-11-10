import type {
	CardStatus,
	ChunkId,
	CourseColor,
	CourseId,
	ExamFormat,
	ExerciseKind
} from '#lib/db/schemas/common.ts';

/**
 * What the course page and the learn screen show. Plain types, so UI code needn't import the
 * engine (lint boundary).
 *
 * @see BUILD_PLAN §6.6–§6.8, §9
 */

/** How today's review runs for a course. */
export type ReviewKind = 'longterm' | 'cram' | 'morningCheck';

/** A day of the cram plan, as the course page lists it. */
export interface CramDayView {
	day: number;
	slot: 'evening' | 'finalPass' | 'morning';
	cards: number;
	newCards: number;
	minutes: number;
}

export interface CramView {
	feasible: boolean;
	shortfallMinutes: number;
	degradations: ('criterion' | 'relearning' | 'deferNew')[];
	deferred: number;
	days: CramDayView[];
}

/** A unit to learn, with its cost before starting. */
export interface UnitView {
	key: string;
	title: string;
	minutes: number;
	steps: number;
	cards: number;
}

export interface OneNightView {
	chosen: UnitView[];
	skipped: UnitView[];
	breakMinutes: number;
	/** Cards met in block 1 tonight, which block 2 re-quizzes. */
	block2Cards: number;
	minutes: number;
	complete: boolean;
}

export interface CourseToday {
	course: {
		id: CourseId;
		name: string;
		color: CourseColor;
		examDate: string | null;
		examTime: string | null;
		examFormat: ExamFormat;
	};
	/** Study days to the exam (0 = exam day), or `null`. */
	daysToExam: number | null;
	counts: Partial<Record<CardStatus, number>>;
	review: { kind: ReviewKind; cards: number; minutes: number; cram: CramView | null };
	learn:
		| { mode: 'acquisition'; path: 'full' | 'quick'; units: UnitView[] }
		| { mode: 'onenight'; plan: OneNightView }
		| null;
	/** Chunks still weak at their next-day retest: suggest splitting them. */
	splitPrompts: { chunkId: ChunkId; title: string }[];
}

/** One step of a unit, as the learn screen runs it. */
export type LearnStepView =
	| { step: 'pretrain' | 'pretest'; cards: number }
	| { step: 'read'; chunkId: ChunkId; text: string; generated: boolean }
	| { step: 'quiz'; cards: number; kinds: ExerciseKind[] };

export interface LearnUnitView {
	courseId: CourseId;
	mode: 'acquisition' | 'onenight';
	unit: UnitView;
	steps: LearnStepView[];
}
