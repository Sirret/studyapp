import type { PageLoad } from './$types';

/**
 * The unit to learn and the step it is on. `quiz` names the chunk-quiz session that just ended,
 * so the screen can set the split flag once.
 */
export const load: PageLoad = ({ params, url }) => ({
	courseId: params.courseId,
	unitKey: params.unitKey,
	step: Math.max(0, Number(url.searchParams.get('step') ?? 0) || 0),
	quizSession: url.searchParams.get('quiz')
});
