import { describe, expect, it } from 'vitest';
import type { TodayCourseView } from '#lib/services/planner-types.ts';
import {
	dateStamp,
	examLine,
	modeLabel,
	shelfLine,
	suggestionOf,
	workLine
} from '#lib/ui/home/home-text.ts';

const course = (name: string, dueCards: number): TodayCourseView => ({
	id: name as never,
	name,
	color: 'pine' as never,
	examDate: null,
	daysToExam: null,
	plannedMinutes: null,
	dueCards,
	unitsToLearn: 0,
	readiness: 0
});

/** @see SESSION_NOTES §K; DESIGN §12 rows "Welcome, Home, Today", "Courses" */
describe('home text', () => {
	it('date stamp: weekday · day month, local time', () => {
		expect(dateStamp(new Date(2026, 10, 13, 9))).toBe('FRI · 13 NOV');
		expect(dateStamp(new Date(2026, 0, 4, 23, 59))).toBe('SUN · 4 JAN');
	});

	it('exam and work lines', () => {
		expect([null, 0, 1, 5].map((daysToExam) => examLine({ daysToExam }))).toStrictEqual([
			'No exam date',
			'Exam today',
			'Exam tomorrow',
			'Exam in 5 days'
		]);
		expect(workLine({ dueCards: 12, unitsToLearn: 0 })).toBe('12 due');
		expect(workLine({ dueCards: 0, unitsToLearn: 3 })).toBe('0 due · 3 to learn');
	});

	it('shelf line counts topics and sections read', () => {
		expect(shelfLine({ topics: 8, sections: 24, read: 9 })).toBe('8 topics · 9 of 24 read');
		expect(shelfLine({ topics: 1, sections: 0, read: 0 })).toBe('1 topic · 0 of 0 read');
	});

	it('mode labels', () => {
		expect([modeLabel('learn'), modeLabel('practice'), modeLabel('exam')]).toStrictEqual([
			'Learn',
			'Practice',
			'Exam prep'
		]);
	});

	it('the suggestion offers the course with the most due cards, never when done', () => {
		const courses = [course('Nets', 3), course('Security', 5), course('Maths', 0)];
		expect(suggestionOf({ courses, done: false })).toMatchObject({
			course: { name: 'Security' },
			text: 'Only if you fancy it: 5 Security cards to review.'
		});
		expect(suggestionOf({ courses, done: true })).toBeNull();
		expect(suggestionOf({ courses: [course('Maths', 0)], done: false })).toBeNull();
		expect(suggestionOf({ courses: [course('Nets', 1)], done: false })?.text).toBe(
			'Only if you fancy it: 1 Nets card to review.'
		);
	});
});
