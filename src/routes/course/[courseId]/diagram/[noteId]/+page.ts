import type { PageLoad } from './$types';

/** The diagram note to edit (the text-first diagram editor, BUILD_PLAN §7.2). */
export const load: PageLoad = ({ params }) => ({
	courseId: params.courseId,
	noteId: params.noteId
});
