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
