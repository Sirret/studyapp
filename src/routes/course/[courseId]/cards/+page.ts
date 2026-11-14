import type { PageLoad } from './$types';

/**
 * The course whose cards to list; `filter=flagged` opens "Check these" (linked from the import's
 * unsure cards), `note` scrolls to and highlights one note.
 */
export const load: PageLoad = ({ params, url }) => ({
	courseId: params.courseId,
	filter: url.searchParams.get('filter'),
	note: url.searchParams.get('note')
});
