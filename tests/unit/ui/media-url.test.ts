import { describe, expect, it, vi } from 'vitest';
import { createMediaUrl } from '#lib/ui/figures/media-url.ts';

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
