import { describe, expect, it } from 'vitest';
import type { TopicId } from '#lib/db/schemas/common.ts';
import type { CourseToday } from '#lib/services/course-types.ts';
import type { LearnTopicView } from '#lib/services/learn-types.ts';
import { courseDoors } from '#lib/ui/course-map/doors.ts';

/** DESIGN §7 ModeDoor, §12 Course; SESSION_NOTES J: pick the scope, then a mode door. */
function topic(sections: number, read: number): LearnTopicView {
	return { id: 't' as TopicId, name: 'T', sections, cards: sections * 2, read, outline: [] };
}

function today(overrides: Partial<CourseToday> = {}): CourseToday {
	return {
		course: {
			id: 'c1',
			name: 'Networks',
			color: 'pine',
			examDate: null,
			examTime: null,
			examFormat: 'mixed'
		},
		daysToExam: null,
		counts: {},
		review: { kind: 'longterm', cards: 0, minutes: 0, cram: null },
		learn: null,
		splitPrompts: [],
		map: null,
		...overrides
	} as CourseToday;
}

describe('courseDoors', () => {
	it('gives Learn, Practice, Exam prep and a disabled Play, in that order', () => {
		const doors = courseDoors(today(), []);
		expect(doors.map((door) => door.mode)).toEqual(['learn', 'practice', 'exam', 'play']);
		expect(doors.map((door) => door.disabled)).toEqual([false, false, false, true]);
		expect(doors[3]).toMatchObject({ hasWork: false, action: { kind: 'none' } });
	});

	it('Learn opens the Learn screen and counts the unread sections in scope', () => {
		const [learn] = courseDoors(today(), [topic(3, 1), topic(2, 0)]);
		expect(learn).toMatchObject({
			hint: '4 sections to read',
			hasWork: true,
			action: { kind: 'learn' }
		});
	});

	it('Learn with everything read invites a reread, without the has-work dot', () => {
		const [learn] = courseDoors(today(), [topic(2, 2)]);
		expect(learn).toMatchObject({ hint: 'All read · read again', hasWork: false });
		expect(courseDoors(today(), [])[0]).toMatchObject({ hint: 'Nothing to read', hasWork: false });
	});

	it("Practice starts today's review when cards are due, else opens Exam prep", () => {
		const [, practice] = courseDoors(
			today({ review: { kind: 'longterm', cards: 12, minutes: 9, cram: null } }),
			[]
		);
		expect(practice).toMatchObject({
			hint: '12 cards due',
			hasWork: true,
			action: { kind: 'review' }
		});
		expect(courseDoors(today(), [])[1]).toMatchObject({
			hint: 'Nothing due',
			hasWork: false,
			action: { kind: 'exam' }
		});
	});

	it('Exam prep opens the Exam prep screen and names the days left', () => {
		const hints = [null, 0, 1, 4].map(
			(daysToExam) => courseDoors(today({ daysToExam }), [])[2]?.hint
		);
		expect(hints).toEqual(['Set a date', 'Exam today', 'Tomorrow', 'In 4 days']);
		expect(courseDoors(today(), [])[2]?.action).toEqual({ kind: 'exam' });
	});

	it('Exam prep shows the has-work dot only while cramming or on the exam morning', () => {
		const kinds = ['longterm', 'cram', 'morningCheck'] as const;
		const dots = kinds.map(
			(kind) =>
				courseDoors(today({ review: { kind, cards: 0, minutes: 0, cram: null } }), [])[2]?.hasWork
		);
		expect(dots).toEqual([false, true, true]);
	});
});
