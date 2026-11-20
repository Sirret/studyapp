import { resolve } from '$app/paths';
import type { NavHrefs } from './nav-tabs.ts';

/** The main navigation's hrefs, for BottomNav and Sidebar (DESIGN §7): Den, Shelf, Import notes. */
export function bottomNavHrefs(): NavHrefs {
	return {
		den: resolve('/'),
		shelf: resolve('/courses'),
		import: resolve('/import')
	};
}
