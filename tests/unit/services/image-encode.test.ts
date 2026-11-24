import { afterEach, describe, expect, it, vi } from 'vitest';
import { CANNOT_ENCODE, encodeImage, NOT_AN_IMAGE } from '#lib/services/image-encode.ts';

/** A decodable 400×200 bitmap whose `close` is tracked. */
function stubBitmap() {
	const close = vi.fn();
	vi.stubGlobal(
		'createImageBitmap',
		vi.fn(async () => ({ width: 400, height: 200, close }))
	);
	return close;
}

/** An OffscreenCanvas whose context and `convertToBlob` behave as given. */
function stubCanvas(options: { context?: boolean; convert?: () => Promise<Blob> }) {
	const convert = options.convert ?? (async () => new Blob(['x'], { type: 'image/webp' }));
	vi.stubGlobal(
		'OffscreenCanvas',
		class {
			getContext() {
				return options.context === false ? null : { drawImage: () => undefined };
			}
			convertToBlob = convert;
		}
	);
}

afterEach(() => vi.unstubAllGlobals());

describe('encodeImage never throws (Phase 6 review: a throw hung the worker reply)', () => {
	it('returns an error when the canvas throws, and still closes the bitmap', async () => {
		const close = stubBitmap();
		stubCanvas({
			convert: async () => {
				throw new RangeError('too big');
			}
		});
		const result = await encodeImage(new Blob(['png']));
		expect(result).toEqual({ ok: false, error: NOT_AN_IMAGE });
		expect(close).toHaveBeenCalledOnce();
	});

	it('returns an error instead of a blank image when there is no 2D context', async () => {
		stubBitmap();
		stubCanvas({ context: false });
		expect(await encodeImage(new Blob(['png']))).toEqual({ ok: false, error: CANNOT_ENCODE });
	});

	it('still encodes a normal image as WebP', async () => {
		stubBitmap();
		stubCanvas({});
		const result = await encodeImage(new Blob(['png']));
		expect(result.ok && result.value.mime).toBe('image/webp');
	});
});
