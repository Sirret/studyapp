import { safeBackPath } from '#lib/services/back-path.ts';
import type { PageLoad } from './$types';

/**
 * The session to run, from the URL, and where to go when it ends (`back`, an in-app path; anything
 * else falls back to Today). `unit=1`: a step inside a Learn unit, which shows no round or session
 * summary (the unit has one at its end).
 */
export const load: PageLoad = ({ params, url }) => {
	return {
		sessionId: params.sessionId,
		back: safeBackPath(url.searchParams.get('back'), url.origin),
		inUnit: url.searchParams.get('unit') === '1'
	};
};
