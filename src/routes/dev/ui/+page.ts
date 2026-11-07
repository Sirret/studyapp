import { error } from '@sveltejs/kit';

/** The style guide exists in dev and e2e builds only (DESIGN §10, §13.4). */
export function load(): void {
	if (!__DEV_ROUTES__) error(404, 'Not found');
}
