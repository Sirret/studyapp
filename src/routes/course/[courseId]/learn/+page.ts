import type { PageLoad } from './$types';

/**
 * Learn for a course: without `topic`, the in-scope topics to pick from; with it, that topic's
 * flow at screen `step` (0 = the first; past the last = topic done).
 */
export const load: PageLoad = ({ params, url }) => ({
	courseId: params.courseId,
	topic: url.searchParams.get('topic'),
	step: Math.max(0, Number(url.searchParams.get('step') ?? 0) || 0)
});
