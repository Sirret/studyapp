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

	it('Practice opens the Practice screen, counts the in-scope cards, never shows the dot', () => {
		const [, practice] = courseDoors(
			today({ review: { kind: 'longterm', cards: 12, minutes: 9, cram: null } }),
			[topic(3, 0), topic(1, 1)]
		);
		expect(practice).toMatchObject({
			hint: '8 cards · flashcards, quiz',
			hasWork: false,
			action: { kind: 'practice' }
		});
		expect(courseDoors(today(), [])[1]).toMatchObject({
			hint: 'No cards yet',
			hasWork: false,
			action: { kind: 'practice' }
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

	it('Learn and Practice count a topic made only of diagrams and pictures', () => {
		const pics: LearnTopicView = {
			...topic(0, 0),
			cards: 4,
			figures: 4,
			figuresNew: 4
		};
		const [learn, practice] = courseDoors(today(), [pics]);
		expect(learn).toMatchObject({ hint: '4 diagrams and pictures', hasWork: true });
		expect(practice?.hint).toBe('4 cards · flashcards, quiz');
	});

	it('Learn adds the figures after the sections to read', () => {
		const mixed: LearnTopicView = { ...topic(2, 1), figures: 1, figuresNew: 0 };
		expect(courseDoors(today(), [mixed])[0]?.hint).toBe('1 section to read · 1 diagram or picture');
	});

	it('Learn says Nothing to read only with no sections and no figures', () => {
		expect(courseDoors(today(), [topic(0, 0)])[0]?.hint).toBe('Nothing to read');
	});
});
