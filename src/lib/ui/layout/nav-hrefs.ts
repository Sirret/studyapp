import { resolve } from '$app/paths';
import type { NavHrefs } from './nav-tabs.ts';

/**
 * The main navigation's hrefs, for BottomNav and Sidebar (DESIGN §7): Den, Shelf, Import notes.
 * On a course's pages, pass its ID: Import then opens with that course picked
 * (Decisions "UX fix: import course picker").
 */
export function bottomNavHrefs(courseId?: string): NavHrefs {
	return {
		den: resolve('/'),
		shelf: resolve('/courses'),
		import: importHref(courseId)
	};
}

/** The import screen, with `courseId` picked when given. */
export function importHref(courseId?: string): string {
	const base = resolve('/import');
	return courseId ? `${base}?course=${encodeURIComponent(courseId)}` : base;
}
