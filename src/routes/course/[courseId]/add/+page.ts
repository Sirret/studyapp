import type { PageLoad } from './$types';

/** Manual mode's add form for a course; `topic=<id>` picks the topic to add to. */
export const load: PageLoad = ({ params, url }) => ({
	courseId: params.courseId,
	topic: url.searchParams.get('topic')
});
