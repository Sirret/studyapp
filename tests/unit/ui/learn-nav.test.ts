import { describe, expect, it } from 'vitest';
import type { ChunkId, TopicId } from '#lib/db/schemas/common.ts';
import type { LearnScreen, LearnTopicView } from '#lib/services/learn-types.ts';
import {
	nextTopic,
	readerOutline,
	sectionPosition,
	stepLabel,
	stepMeta
} from '#lib/ui/learn/learn-nav.ts';

/** SESSION_NOTES C; DESIGN §12 Reader, Topic done: the Learn screen's display rules. */
const c = (id: string) => id as ChunkId;

function read(id: string, title: string | null): LearnScreen {
	return {
		step: 'read',
		chunkId: c(id),
		title,
		text: 'Text',
		tip: null,
		terms: [],
		generated: false,
		session: false
	};
}

const SCREENS: LearnScreen[] = [
	{ step: 'summary', at: 'start', text: 'Intro', session: false },
	read('a', 'Layers'),
	{ step: 'questions', chunkId: c('a'), cards: 2, session: true },
	read('b', null),
	{ step: 'questions', chunkId: c('b'), cards: 1, session: true },
	{ step: 'lookBack', chunkId: c('b'), session: true },
	{ step: 'mixedQuiz', cards: 5, session: true },
	{ step: 'summary', at: 'end', text: 'Recap', session: false }
];

function topic(id: string, sections: number, readCount: number): LearnTopicView {
	return { id: id as TopicId, name: id, sections, cards: 4, read: readCount, outline: [] };
}

describe('learn-nav', () => {
	it('places a read screen among the topic’s sections; other screens have no place', () => {
		expect(sectionPosition(SCREENS, 1)).toStrictEqual({ n: 1, of: 2 });
		expect(sectionPosition(SCREENS, 3)).toStrictEqual({ n: 2, of: 2 });
		expect(sectionPosition(SCREENS, 2)).toBeNull();
	});

	it('the reader outline marks earlier sections done and names untitled ones by position', () => {
		expect(readerOutline(SCREENS, 3)).toStrictEqual([
			{ title: 'Layers', state: 'done' },
			{ title: 'Section 2', state: 'current' }
		]);
		expect(readerOutline(SCREENS, 1).map((item) => item.state)).toStrictEqual(['current', 'todo']);
	});

	it('session screens carry a meta; reading and summaries do not', () => {
		expect(SCREENS.map(stepMeta)).toStrictEqual([
			undefined,
			undefined,
			'2 questions',
			undefined,
			'1 question',
			'Look-back',
			'5 questions',
			undefined
		]);
	});

	it('labels the button by the screen it leads into, and the end as finishing', () => {
		expect(stepLabel(SCREENS[2])).toBe('Quick questions');
		expect(stepLabel(SCREENS[5])).toBe('One from earlier');
		expect(stepLabel(undefined)).toBe('Finish the topic');
	});

	it('the next topic is the first later one with unread sections, else the next, else none', () => {
		const topics = [topic('t1', 2, 0), topic('t2', 2, 2), topic('t3', 3, 1)];
		expect(nextTopic(topics, 't1' as TopicId)?.id).toBe('t3');
		const allRead = [topic('t1', 2, 0), topic('t2', 2, 2)];
		expect(nextTopic(allRead, 't1' as TopicId)?.id).toBe('t2');
		expect(nextTopic(topics, 't3' as TopicId)).toBeNull();
	});
});
