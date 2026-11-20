import type { PageLoad } from './$types';

/**
 * Practice for a course: the menu (flashcards or a quick quiz); `view=deck` opens the flashcard
 * deck; `quiz=<sessionId>` shows the summary of the quick quiz that just ended.
 */
export const load: PageLoad = ({ params, url }) => ({
	courseId: params.courseId,
	deck: url.searchParams.get('view') === 'deck',
	quiz: url.searchParams.get('quiz')
});
