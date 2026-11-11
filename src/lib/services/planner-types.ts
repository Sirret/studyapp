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

/** The first exam that doesn't fit, in words the shortfall note can use. */
export interface ShortfallView {
	courseId: CourseId;
	courseName: string;
	examDate: string;
	shortfallMinutes: number;
	/** Pieces of work the planner suggests leaving out, across the exams due by then. */
	cutCount: number;
}

export interface TodayPlanView {
	courses: TodayCourseView[];
	/** Minutes studied today (logged answers). */
	studiedMinutes: number;
	shortfall: ShortfallView | null;
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
