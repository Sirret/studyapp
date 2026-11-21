import type { MediaId } from '#lib/services/study-types.ts';

/** The part of the `URL` global this helper uses, so tests can pass a fake. */
export type ObjectUrlApi = Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;

/** An object URL for a stored image, with the release that frees it. */
export interface MediaUrl {
	readonly url: string;
	/** Frees the URL; safe to call more than once. */
	revoke(): void;
}

/**
 * Turns a stored image blob into a URL an `<img>` can show. Blobs stay in IndexedDB only (no
 * copies in Cache Storage); the component that asked revokes the URL when it is destroyed.
 *
 * @see BUILD_PLAN §4.2; WIP step 5
 */
export function createMediaUrl(blob: Blob, api: ObjectUrlApi = URL): MediaUrl {
	const url = api.createObjectURL(blob);
	let live = true;
	return {
		url,
		revoke() {
			if (!live) return;
			live = false;
			api.revokeObjectURL(url);
		}
	};
}

/** Gives a stored image's bytes by id (the study screen passes `StudyService.media`). */
export type MediaLoader = (id: MediaId) => Promise<Blob | null>;

/**
 * Loads an image for a component: calls `show(url)` once the blob is read, or `show(null)` when
 * it is gone. Returns the cleanup for `$effect`: it frees the URL, and a load that finishes
 * after cleanup shows nothing.
 */
export function watchMedia(
	loader: MediaLoader,
	id: MediaId,
	show: (url: string | null) => void,
	api: ObjectUrlApi = URL
): () => void {
	let live = true;
	let handle: MediaUrl | null = null;
	loader(id).then(
		(blob) => {
			if (!live) return;
			if (!blob) return show(null);
			handle = createMediaUrl(blob, api);
			show(handle.url);
		},
		() => live && show(null)
	);
	return () => {
		live = false;
		handle?.revoke();
	};
}
