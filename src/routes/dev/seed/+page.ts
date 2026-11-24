import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/**
 * Test data for review: exists in dev and test builds only (`__DEV_ROUTES__`), never in the
 * deploy build (Decisions log "Pre-review step: /dev/seed").
 */
export const load: PageLoad = () => {
	if (!__DEV_ROUTES__) error(404, 'Not found');
	return {};
};
