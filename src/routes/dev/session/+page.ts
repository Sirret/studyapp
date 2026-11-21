import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/**
 * The e2e session harness exists in dev and e2e builds only (Decisions log, Phase 5).
 * `figures=<courseId>` offers a session over that course's image and diagram cards (WIP step 9).
 */
export const load: PageLoad = ({ url }) => {
	if (!__DEV_ROUTES__) error(404, 'Not found');
	return { figures: url.searchParams.get('figures') };
};
