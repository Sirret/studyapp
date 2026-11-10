import type { PageLoad } from './$types';

/**
 * The session to run, from the URL, and where to go when it ends (`back`, an in-app path; anything
 * else falls back to Today).
 */
export const load: PageLoad = ({ params, url }) => {
	const back = url.searchParams.get('back');
	return {
		sessionId: params.sessionId,
		back: back?.startsWith('/') && !back.startsWith('//') ? back : null
	};
};
