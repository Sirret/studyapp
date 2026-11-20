/**
 * Display rules for Home and the Shelf (`/`, `/courses`): the date stamp, a course's exam and
 * work lines, its reading line, the mode label on "Where you left off", and the gentle
 * suggestion. Pure, so the routes stay thin. No streak copy anywhere (SESSION_NOTES §K).
 *
 * @see SESSION_NOTES §K; DESIGN §12 rows "Welcome, Home, Today", "Courses"
 */
import type { LeftOffMode } from '#lib/services/home-service.ts';
import type { TodayCourseView, TodayPlanView } from '#lib/services/planner-types.ts';
import { countOf } from '#lib/util/plural.ts';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTHS = [
	'JAN',
	'FEB',
	'MAR',
	'APR',
	'MAY',
	'JUN',
	'JUL',
	'AUG',
	'SEP',
	'OCT',
	'NOV',
	'DEC'
] as const;

/** The TopBar's date stamp, local time: "FRI · 13 NOV". */
export function dateStamp(date: Date): string {
	return `${WEEKDAYS[date.getDay()]} · ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "Exam in 5 days", "Exam tomorrow", "Exam today", or "No exam date". */
export function examLine(course: Pick<TodayCourseView, 'daysToExam'>): string {
	if (course.daysToExam === null) return 'No exam date';
	if (course.daysToExam === 0) return 'Exam today';
	if (course.daysToExam === 1) return 'Exam tomorrow';
	return `Exam in ${course.daysToExam} days`;
}

/** "12 due · 3 to learn" (the "to learn" part only when there is some). */
export function workLine(course: Pick<TodayCourseView, 'dueCards' | 'unitsToLearn'>): string {
	const parts = [`${course.dueCards} due`];
	if (course.unitsToLearn > 0) parts.push(`${course.unitsToLearn} to learn`);
	return parts.join(' · ');
}

/** "8 topics · 9 of 24 read". */
export function shelfLine(course: { topics: number; sections: number; read: number }): string {
	return `${countOf(course.topics, 'topic')} · ${course.read} of ${course.sections} read`;
}

/** The mode a "Continue" goes back to, as the card's meta says it. */
export function modeLabel(mode: LeftOffMode): string {
	switch (mode) {
		case 'learn':
			return 'Learn';
		case 'practice':
			return 'Practice';
		case 'exam':
			return 'Exam prep';
	}
}

/** Home's gentle suggestion: the course with the most cards due, offered, never pushed. */
export interface Suggestion {
	course: TodayCourseView;
	text: string;
}

/**
 * The course with the most due cards, phrased as an offer ("Only if you fancy it: …"); null when
 * nothing is due or today's planned minutes are used up (then Yuki says rest instead).
 */
export function suggestionOf(plan: Pick<TodayPlanView, 'courses' | 'done'>): Suggestion | null {
	if (plan.done) return null;
	const due = plan.courses.filter((course) => course.dueCards > 0);
	const course = [...due].sort((a, b) => b.dueCards - a.dueCards)[0];
	if (!course) return null;
	return {
		course,
		text: `Only if you fancy it: ${countOf(course.dueCards, `${course.name} card`)} to review.`
	};
}
