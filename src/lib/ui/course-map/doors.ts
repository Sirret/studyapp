import type { CourseToday } from '#lib/services/course-types.ts';
import type { LearnTopicView } from '#lib/services/learn-types.ts';
import { countOf } from '#lib/util/plural.ts';

/**
 * Where a course-page door goes: the Learn screen, today's review, the Exam prep screen, or
 * nowhere yet (Play, until Phase 11).
 */
export type DoorAction =
	{ kind: 'learn' } | { kind: 'review' } | { kind: 'exam' } | { kind: 'none' };

export interface DoorView {
	mode: 'learn' | 'practice' | 'exam' | 'play';
	hint: string;
	hasWork: boolean;
	/** Not open yet (Play): drawn faded with a "Coming soon" stamp. */
	disabled: boolean;
	action: DoorAction;
}

/**
 * The course page's four ModeDoors, after the scope is picked (SESSION_NOTES J "pick, then
 * mode"): Learn opens `/course/[id]/learn`, Practice starts today's review (its own screen comes
 * in step 9 of Phase 8.6) or, with nothing due, opens Exam prep, Exam prep opens
 * `/course/[id]/exam`, and Play is disabled until Phase 11. `topics` are the in-scope topics.
 * @see DESIGN §7 ModeDoor, §12 Course; SESSION_NOTES C, J
 */
export function courseDoors(today: CourseToday, topics: readonly LearnTopicView[]): DoorView[] {
	return [
		learnDoor(topics),
		practiceDoor(today),
		examDoor(today),
		{ mode: 'play', hint: 'Study games', hasWork: false, disabled: true, action: { kind: 'none' } }
	];
}

function learnDoor(topics: readonly LearnTopicView[]): DoorView {
	const sections = topics.reduce((sum, topic) => sum + topic.sections, 0);
	const unread = topics.reduce((sum, topic) => sum + topic.sections - topic.read, 0);
	const hint =
		sections === 0
			? 'Nothing to read'
			: unread === 0
				? 'All read · read again'
				: `${countOf(unread, 'section')} to read`;
	return { mode: 'learn', hint, hasWork: unread > 0, disabled: false, action: { kind: 'learn' } };
}

function practiceDoor(today: CourseToday): DoorView {
	const cards = today.review.cards;
	return cards === 0
		? {
				mode: 'practice',
				hint: 'Nothing due',
				hasWork: false,
				disabled: false,
				action: { kind: 'exam' }
			}
		: {
				mode: 'practice',
				hint: `${countOf(cards, 'card')} due`,
				hasWork: true,
				disabled: false,
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
		disabled: false,
		action: { kind: 'exam' }
	};
}
