import { error } from '@sveltejs/kit';

/** The e2e session harness exists in dev and e2e builds only (Decisions log, Phase 5). */
export function load(): void {
	if (!__DEV_ROUTES__) error(404, 'Not found');
}
