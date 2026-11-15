import { resolve } from '$app/paths';

/**
 * The BottomNav tabs' hrefs (DESIGN §7 BottomNav). The Shelf is the course list on Home until
 * 8.6 adds its own screen.
 */
export function bottomNavHrefs(): { den: string; shelf: string; import: string } {
	return {
		den: resolve('/'),
		shelf: `${resolve('/')}#shelf`,
		import: resolve('/import')
	};
}
