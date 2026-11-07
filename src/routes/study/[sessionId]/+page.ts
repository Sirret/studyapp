import type { PageLoad } from './$types';

/** The session to run, from the URL. */
export const load: PageLoad = ({ params }) => ({ sessionId: params.sessionId });
