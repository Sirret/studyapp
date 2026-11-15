import { resolve } from '$app/paths';
import type { NavHrefs } from './nav-tabs.ts';

/**
 * The main navigation's hrefs, for BottomNav and Sidebar (DESIGN §7). The Shelf is the course list on Home until
 * 8.6 adds its own screen.
 */
export function bottomNavHrefs(): NavHrefs {
	return {
		den: resolve('/'),
		shelf: `${resolve('/')}#shelf`,
		import: resolve('/import')
	};
}
