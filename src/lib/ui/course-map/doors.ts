import type { CourseToday } from '#lib/services/course-types.ts';
import type { LearnTopicView } from '#lib/services/learn-types.ts';
import { countOf } from '#lib/util/plural.ts';

/**
 * Where a course-page door goes: the Learn, Practice or Exam prep screen, or nowhere yet (Play,
 * until Phase 11).
 */
export type DoorAction =
	{ kind: 'learn' } | { kind: 'practice' } | { kind: 'exam' } | { kind: 'none' };

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
 * mode"): Learn opens `/course/[id]/learn`, Practice opens `/course/[id]/practice` (flashcards
 * and a quick quiz over the in-scope cards; optional, so it never shows the has-work dot), Exam
 * prep opens `/course/[id]/exam`, and Play is disabled until Phase 11. `topics` are the in-scope
 * topics.
 * @see DESIGN §7 ModeDoor, §12 Course; SESSION_NOTES C, J
 */
export function courseDoors(today: CourseToday, topics: readonly LearnTopicView[]): DoorView[] {
	return [
		learnDoor(topics),
		practiceDoor(topics),
		examDoor(today),
		{ mode: 'play', hint: 'Study games', hasWork: false, disabled: true, action: { kind: 'none' } }
	];
}

/** Learn counts sections to read and, after them, the topics' diagrams and pictures. */
function learnDoor(topics: readonly LearnTopicView[]): DoorView {
	const sections = topics.reduce((sum, topic) => sum + topic.sections, 0);
	const unread = topics.reduce((sum, topic) => sum + topic.sections - topic.read, 0);
	const figures = topics.reduce((sum, topic) => sum + (topic.figures ?? 0), 0);
	const figuresNew = topics.reduce((sum, topic) => sum + (topic.figuresNew ?? 0), 0);
	const reading =
		sections === 0
			? null
			: unread === 0
				? 'All read · read again'
				: `${countOf(unread, 'section')} to read`;
	const pictures =
		figures === 0 ? null : countOf(figures, 'diagram or picture', 'diagrams and pictures');
	const hint = [reading, pictures].filter((part) => part !== null).join(' · ') || 'Nothing to read';
	const hasWork = unread > 0 || figuresNew > 0;
	return { mode: 'learn', hint, hasWork, disabled: false, action: { kind: 'learn' } };
}

function practiceDoor(topics: readonly LearnTopicView[]): DoorView {
	const cards = topics.reduce((sum, topic) => sum + topic.cards, 0);
	return {
		mode: 'practice',
		hint: cards === 0 ? 'No cards yet' : `${countOf(cards, 'card')} · flashcards, quiz`,
		hasWork: false,
		disabled: false,
		action: { kind: 'practice' }
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
