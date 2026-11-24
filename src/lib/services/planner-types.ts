import type { CourseColor, CourseId } from '#lib/db/schemas/common.ts';

/**
 * What Today and the Plan screen show. Plain types, so UI code needn't import the engine
 * (lint boundary).
 *
 * @see BUILD_PLAN §6.9, §9 and DESIGN §6 (Today, Plan)
 */

/** A course on Today. */
export interface TodayCourseView {
	id: CourseId;
	name: string;
	color: CourseColor;
	examDate: string | null;
	/** Study days to the exam (0 = exam day), or `null` with no exam ahead. */
	daysToExam: number | null;
	/** Minutes the planner gives the course today; `null` when it has no exam ahead. */
	plannedMinutes: number | null;
	/** Cards due for review now. */
	dueCards: number;
	/** Parts still to learn. */
	unitsToLearn: number;
	/** Share of live cards that are exam-ready or secure (0–1). */
	readiness: number;
}

/** One planner run's numbers for a course page (`PlannerService.courseShares`). */
export interface CoursePlanShares {
	share: number[] | null;
	cramShare: number[] | null;
	fit: PlanFitView | null;
}

/**
 * Whether an exam's work fits the time before it: the planner's processor-demand check before and
 * after its suggested degrading and cuts. Home's note and Exam prep's banner both show this one
 * view (`PlannerService.fitOf`), so their numbers agree (Decisions "UX fix: one plan verdict").
 */
export interface PlanFitView {
	courseId: CourseId;
	courseName: string;
	examDate: string;
	/** Fits with nothing lowered or cut. */
	fits: boolean;
	/** Fits once the degradations and cuts below are made. */
	fitsAfterCuts: boolean;
	/** Minutes still short after the degradations and cuts (0 when `fitsAfterCuts`). */
	shortfallMinutes: number;
	/** What the plan lowers, across the courses with an exam by then, each once, in order. */
	degradations: ('criterion' | 'relearning' | 'cut')[];
	/** Pieces of work left out across those courses. */
	cutCount: number;
}

export interface TodayPlanView {
	courses: TodayCourseView[];
	/** Minutes studied today (logged answers). */
	studiedMinutes: number;
	/** The first exam that doesn't fit before cuts, with its verdict after them; null when all fit. */
	shortfall: PlanFitView | null;
	/** Something was studied today and the planned minutes are used up. */
	done: boolean;
}

/** One course's slice of a day's bar. */
export interface PlanSegment {
	courseId: CourseId;
	name: string;
	color: CourseColor;
	minutes: number;
}

export interface PlanDayView {
	/** `YYYY-MM-DD`. */
	date: string;
	today: boolean;
	/** Available minutes (today: what is left of it). */
	capMinutes: number;
	segments: PlanSegment[];
	freeMinutes: number;
	/** Exams on this day. */
	exams: { courseId: CourseId; name: string; color: CourseColor }[];
}

export interface PlanExamView {
	courseId: CourseId;
	name: string;
	color: CourseColor;
	examDate: string;
	fits: boolean;
	shortfallMinutes: number;
	/** Work due by this exam: this course's and every earlier exam's (processor demand). */
	workMinutes: number;
	/** Minutes available from today until this exam, its morning included. */
	availableMinutes: number;
	/** What the planner would degrade, in order: fewer corrects, fewer relearning sessions, cuts. */
	degradations: ('criterion' | 'relearning' | 'cut')[];
	cutCount: number;
}

export interface PlanView {
	days: PlanDayView[];
	exams: PlanExamView[];
	feasible: boolean;
}
