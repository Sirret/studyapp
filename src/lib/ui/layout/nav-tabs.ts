import { FileUp, Gamepad2, House, Library } from '@lucide/svelte';

/** A main-navigation destination (DESIGN §7 BottomNav, Sidebar). */
export type NavTab = 'den' | 'shelf' | 'import' | 'play';

/** resolve()d hrefs for the main navigation; Play shows only when its href is given (Phase 11). */
export type NavHrefs = Record<Exclude<NavTab, 'play'>, string> & { play?: string };

/**
 * The main navigation's tabs, shared by BottomNav (mobile) and Sidebar (desktop ≥ 1024 px) so
 * both always show the same items.
 * @see DESIGN §7 BottomNav, Sidebar
 */
export const NAV_TABS = [
	{ id: 'den', label: 'Den', icon: House },
	{ id: 'shelf', label: 'Shelf', icon: Library },
	{ id: 'import', label: 'Import notes', icon: FileUp },
	{ id: 'play', label: 'Play', icon: Gamepad2 }
] as const;

/** The tabs to show: those with an href. */
export function shownTabs(hrefs: NavHrefs): (typeof NAV_TABS)[number][] {
	return NAV_TABS.filter((tab) => hrefs[tab.id] !== undefined);
}
