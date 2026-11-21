import type { PageLoad } from './$types';

/** The image note to edit (the occlusion editor, BUILD_PLAN §7.1). */
export const load: PageLoad = ({ params }) => ({
	courseId: params.courseId,
	noteId: params.noteId
});
