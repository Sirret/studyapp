import { describe, expect, it, vi } from 'vitest';
import type { MediaId } from '#lib/services/study-types.ts';
import { createMediaUrl, watchMedia } from '#lib/ui/figures/media-url.ts';

describe('createMediaUrl', () => {
	it('creates an object URL for the blob and revokes it once', () => {
		const api = {
			createObjectURL: vi.fn(() => 'blob:one'),
			revokeObjectURL: vi.fn()
		};
		const blob = new Blob(['x']);
		const media = createMediaUrl(blob, api);
		expect(media.url).toBe('blob:one');
		expect(api.createObjectURL).toHaveBeenCalledWith(blob);
		media.revoke();
		media.revoke();
		expect(api.revokeObjectURL).toHaveBeenCalledTimes(1);
		expect(api.revokeObjectURL).toHaveBeenCalledWith('blob:one');
	});
});

describe('watchMedia', () => {
	const fakeApi = () => ({ createObjectURL: vi.fn(() => 'blob:img'), revokeObjectURL: vi.fn() });
	const id = 'm1' as MediaId;

	it('shows the URL once loaded and revokes it on cleanup', async () => {
		const api = fakeApi();
		const show = vi.fn();
		const stop = watchMedia(() => Promise.resolve(new Blob(['x'])), id, show, api);
		await vi.waitFor(() => expect(show).toHaveBeenCalledWith('blob:img'));
		stop();
		expect(api.revokeObjectURL).toHaveBeenCalledWith('blob:img');
	});

	it('shows null for a missing or unreadable image', async () => {
		const show = vi.fn();
		watchMedia(() => Promise.resolve(null), id, show, fakeApi());
		watchMedia(() => Promise.reject(new Error('gone')), id, show, fakeApi());
		await vi.waitFor(() => expect(show).toHaveBeenCalledTimes(2));
		expect(show).toHaveBeenNthCalledWith(1, null);
		expect(show).toHaveBeenNthCalledWith(2, null);
	});

	it('shows nothing and makes no URL when cleaned up before the load finishes', async () => {
		const api = fakeApi();
		const show = vi.fn();
		let resolve: (blob: Blob) => void = () => undefined;
		const stop = watchMedia(() => new Promise<Blob>((r) => (resolve = r)), id, show, api);
		stop();
		resolve(new Blob(['x']));
		await Promise.resolve();
		await Promise.resolve();
		expect(show).not.toHaveBeenCalled();
		expect(api.createObjectURL).not.toHaveBeenCalled();
	});
});
