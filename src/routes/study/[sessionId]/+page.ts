import { safeBackPath } from '#lib/services/back-path.ts';
import type { PageLoad } from './$types';

/**
 * The session to run, from the URL, and where to go when it ends (`back`, an in-app path; anything
 * else falls back to Today).
 */
export const load: PageLoad = ({ params, url }) => {
	return {
		sessionId: params.sessionId,
		back: safeBackPath(url.searchParams.get('back'), url.origin)
	};
};
