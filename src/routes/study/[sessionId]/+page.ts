import { safeBackPath } from '#lib/services/back-path.ts';
import type { PageLoad } from './$types';

/**
 * The session to run, from the URL, and where to go when it ends (`back`, an in-app path; anything
 * else falls back to Today). `unit=1`: a step inside a Learn unit, which shows no round or session
 * summary (the unit has one at its end). `unit=learn`: a step of a Learn topic, which also skips the
 * session summary but keeps the count rounds' pause (Decisions log "Phase 8.6 Q16").
 */
export const load: PageLoad = ({ params, url }) => {
	const unit = url.searchParams.get('unit');
	return {
		sessionId: params.sessionId,
		back: safeBackPath(url.searchParams.get('back'), url.origin),
		inUnit: unit === '1' || unit === 'learn',
		roundPause: unit === 'learn'
	};
};
