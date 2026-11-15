import { describe, expect, it } from 'vitest';
import type { CourseToday, UnitView } from '#lib/services/course-types.ts';
import { courseDoors } from '#lib/ui/course-map/doors.ts';

/** DESIGN §7 ModeDoor, §12 Course: the doors are shortcuts to what the course page already offers. */
function unit(key: string): UnitView {
	return { key, title: key, minutes: 10, steps: 4 } as UnitView;
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
	it('gives Learn, Practice and Exam prep in that order', () => {
		expect(courseDoors(today()).map((door) => door.mode)).toEqual(['learn', 'practice', 'exam']);
	});

	it('with nothing to do, Learn and Practice scroll to the plan without the has-work dot', () => {
		const [learn, practice] = courseDoors(today());
		expect(learn).toMatchObject({ hasWork: false, action: { kind: 'scroll', target: 'plan' } });
		expect(practice).toMatchObject({ hasWork: false, action: { kind: 'scroll', target: 'plan' } });
	});

	it('Learn opens the first unit to learn and counts the parts', () => {
		const [learn] = courseDoors(
			today({ learn: { mode: 'acquisition', path: 'full', units: [unit('u1'), unit('u2')] } })
		);
		expect(learn).toMatchObject({
			hint: '2 parts to learn',
			hasWork: true,
			action: { kind: 'unit', unitKey: 'u1' }
		});
	});

	it("Learn opens tonight's first chosen part in one-night mode", () => {
		const plan = { chosen: [unit('n1')], skipped: [] } as unknown as Extract<
			CourseToday['learn'],
			{ mode: 'onenight' }
		>['plan'];
		const [learn] = courseDoors(today({ learn: { mode: 'onenight', plan } }));
		expect(learn).toMatchObject({
			hint: '1 part to learn',
			action: { kind: 'unit', unitKey: 'n1' }
		});
	});

	it("Practice starts today's review when cards are due", () => {
		const [, practice] = courseDoors(
			today({ review: { kind: 'longterm', cards: 12, minutes: 9, cram: null } })
		);
		expect(practice).toMatchObject({
			hint: '12 cards due',
			hasWork: true,
			action: { kind: 'review' }
		});
	});

	it('Exam prep scrolls to the exam section and names the days left', () => {
		const hints = [null, 0, 1, 4].map((daysToExam) => courseDoors(today({ daysToExam }))[2]?.hint);
		expect(hints).toEqual(['Set a date', 'Exam today', 'Tomorrow', 'In 4 days']);
		expect(courseDoors(today())[2]?.action).toEqual({ kind: 'scroll', target: 'exam' });
	});

	it('Exam prep shows the has-work dot only while cramming or on the exam morning', () => {
		const kinds = ['longterm', 'cram', 'morningCheck'] as const;
		const dots = kinds.map(
			(kind) =>
				courseDoors(today({ review: { kind, cards: 0, minutes: 0, cram: null } }))[2]?.hasWork
		);
		expect(dots).toEqual([false, true, true]);
	});
});
