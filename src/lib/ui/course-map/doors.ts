import type { CourseToday } from '#lib/services/course-types.ts';
import { countOf } from '#lib/util/plural.ts';

/** Where a course-page door goes: a unit to learn, today's review, or a section of the page. */
export type DoorAction =
	| { kind: 'unit'; unitKey: string }
	| { kind: 'review' }
	| { kind: 'scroll'; target: 'plan' | 'exam' };

export interface DoorView {
	mode: 'learn' | 'practice' | 'exam';
	hint: string;
	hasWork: boolean;
	action: DoorAction;
}

/**
 * The course page's three ModeDoors as shortcuts to what the page already offers (WIP decision,
 * 2026-11-15): Learn opens the first unit to learn, Practice starts today's review, Exam prep
 * scrolls to the exam section. A door with nothing to do scrolls to today's plan.
 * @see DESIGN §7 ModeDoor, §12 Course
 */
export function courseDoors(today: CourseToday): DoorView[] {
	return [learnDoor(today), practiceDoor(today), examDoor(today)];
}

function learnDoor(today: CourseToday): DoorView {
	const units =
		today.learn === null
			? []
			: today.learn.mode === 'acquisition'
				? today.learn.units
				: today.learn.plan.chosen;
	const first = units[0];
	if (first === undefined) {
		return {
			mode: 'learn',
			hint: 'Nothing new',
			hasWork: false,
			action: { kind: 'scroll', target: 'plan' }
		};
	}
	return {
		mode: 'learn',
		hint: `${countOf(units.length, 'part')} to learn`,
		hasWork: true,
		action: { kind: 'unit', unitKey: first.key }
	};
}

function practiceDoor(today: CourseToday): DoorView {
	const cards = today.review.cards;
	if (cards === 0) {
		return {
			mode: 'practice',
			hint: 'Nothing due',
			hasWork: false,
			action: { kind: 'scroll', target: 'plan' }
		};
	}
	return {
		mode: 'practice',
		hint: `${countOf(cards, 'card')} due`,
		hasWork: true,
		action: { kind: 'review' }
	};
}

function examDoor(today: CourseToday): DoorView {
	const days = today.daysToExam;
	const hint =
		days === null
			? 'Set a date'
			: days === 0
				? 'Exam today'
				: days === 1
					? 'Tomorrow'
					: `In ${days} days`;
	return {
		mode: 'exam',
		hint,
		hasWork: today.review.kind !== 'longterm',
		action: { kind: 'scroll', target: 'exam' }
	};
}
