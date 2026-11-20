import type { PageLoad } from './$types';

/** The course whose Exam prep to show; `done` says which planned work just finished. */
export const load: PageLoad = ({ params, url }) => ({
	courseId: params.courseId,
	done: url.searchParams.get('done')
});
