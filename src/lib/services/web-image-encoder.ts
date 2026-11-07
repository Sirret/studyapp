import { IMAGE_MAX_PX, IMAGE_WEBP_QUALITY } from '#lib/config/defaults.ts';
import { fitWithin } from '#lib/import/image-size.ts';
import type { Result } from '#lib/util/result.ts';
import type { EncodedImage, ImageEncoder } from './import-service.ts';

/**
 * Resizes and re-encodes images in the browser. Browsers that can't write WebP (Safari) would
 * silently produce a PNG, so that is reported instead of stored under the wrong type.
 *
 * @see BUILD_PLAN §4.2
 */
export class WebImageEncoder implements ImageEncoder {
	async encode(source: Blob): Promise<Result<EncodedImage, string>> {
		try {
			const bitmap = await createImageBitmap(source);
			const { width, height } = fitWithin(bitmap.width, bitmap.height, IMAGE_MAX_PX);
			const canvas = new OffscreenCanvas(width, height);
			canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
			bitmap.close();
			const blob = await canvas.convertToBlob({ type: 'image/webp', quality: IMAGE_WEBP_QUALITY });
			if (blob.type !== 'image/webp') {
				return { ok: false, error: 'This browser cannot save images as WebP.' };
			}
			return { ok: true, value: { blob, width, height } };
		} catch {
			return { ok: false, error: 'This file could not be read as an image.' };
		}
	}
}
