import type { PageLoad } from './$types';

/** The course to show, from the URL. */
export const load: PageLoad = ({ params }) => ({ courseId: params.courseId });
