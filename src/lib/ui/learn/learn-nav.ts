/**
 * Display rules for the Learn screen (`/course/[id]/learn`): where a section sits in its topic,
 * the reader's outline column, the meta on a button that leads into a session, and which topic
 * comes next. Pure, so the route stays thin.
 *
 * @see SESSION_NOTES C; DESIGN §12 Reader, Question + look-back, Topic done
 */
import type { TopicId } from '#lib/db/schemas/common.ts';
import type { LearnScreen, LearnTopicView } from '#lib/services/learn-types.ts';
import type { RingState } from '#lib/ui/components/PawRing.svelte';
import { countOf } from '#lib/util/plural.ts';

type ReadScreen = Extract<LearnScreen, { step: 'read' }>;

/** The read screens of a flow, with their screen index. */
function reads(screens: readonly LearnScreen[]): { screen: ReadScreen; index: number }[] {
	return screens.flatMap((screen, index) => (screen.step === 'read' ? [{ screen, index }] : []));
}

/** "Section k of n" for the read screen at `index`; null for any other screen. */
export function sectionPosition(
	screens: readonly LearnScreen[],
	index: number
): { n: number; of: number } | null {
	const all = reads(screens);
	const at = all.findIndex((read) => read.index === index);
	return at < 0 ? null : { n: at + 1, of: all.length };
}

/**
 * The reader's outline: every section of the topic, done before the one at `index`, current at
 * it, to do after. Untitled sections are named by position.
 */
export function readerOutline(
	screens: readonly LearnScreen[],
	index: number
): { title: string; state: RingState }[] {
	return reads(screens).map((read, i) => ({
		title: read.screen.title ?? `Section ${i + 1}`,
		state: read.index < index ? 'done' : read.index === index ? 'current' : 'todo'
	}));
}

/** The Courier meta on a button that starts this screen; none for screens that aren't sessions. */
export function stepMeta(screen: LearnScreen | undefined): string | undefined {
	switch (screen?.step) {
		case 'questions':
			return countOf(screen.cards, 'question');
		case 'figures':
			return countOf(screen.cards, 'question');
		case 'mixedQuiz':
			return countOf(screen.cards, 'question');
		case 'lookBack':
			return 'Look-back';
		case 'meetTerms':
			return countOf(screen.terms.length, 'term');
		case 'summary':
		case 'read':
		case 'added':
		case undefined:
			return undefined;
	}
}

/** What the button that leads into this screen says. */
export function stepLabel(screen: LearnScreen | undefined): string {
	switch (screen?.step) {
		case 'questions':
			return 'Quick questions';
		case 'lookBack':
			return 'One from earlier';
		case 'figures':
			return 'Pictures and diagrams';
		case 'mixedQuiz':
			return 'Mixed quiz';
		case 'meetTerms':
			return 'Next section';
		case 'read':
			return 'Read on';
		case 'added':
			return 'Check the added sections';
		case 'summary':
			return 'Wrap up';
		case undefined:
			return 'Finish the topic';
	}
}

/** The in-scope topic after `current` that still has unread sections, else the next one; null at the end. */
export function nextTopic(
	topics: readonly LearnTopicView[],
	current: TopicId
): LearnTopicView | null {
	const at = topics.findIndex((topic) => topic.id === current);
	const after = topics.slice(at + 1);
	return after.find((topic) => topic.read < topic.sections) ?? after[0] ?? null;
}
