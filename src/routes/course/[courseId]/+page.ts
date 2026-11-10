import type { PageLoad } from './$types';

/** The course to show, from the URL; `done` says which planned work just finished. */
export const load: PageLoad = ({ params, url }) => ({
	courseId: params.courseId,
	done: url.searchParams.get('done')
});
