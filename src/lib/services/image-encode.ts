import { IMAGE_JPEG_QUALITY, IMAGE_MAX_PX, IMAGE_WEBP_QUALITY } from '#lib/config/defaults.ts';
import { fitWithin } from '#lib/import/image-size.ts';
import type { Result } from '#lib/util/result.ts';

/** The types an image is stored as (DATA_MODEL §3.8). */
export type StoredImageMime = 'image/webp' | 'image/jpeg';

/** A resized, re-encoded image. */
export interface EncodedImage {
	blob: Blob;
	width: number;
	height: number;
	mime: StoredImageMime;
}

/** What the encode worker sends back for one request. */
export type EncodeReply =
	| { id: number; kind: 'done'; result: Result<EncodedImage, string> }
	| { id: number; kind: 'unsupported' };

/** The message the page sends the encode worker. */
export interface EncodeRequest {
	id: number;
	source: Blob;
}

export const NOT_AN_IMAGE = 'This file could not be read as an image.';
export const CANNOT_ENCODE = 'This browser cannot save images.';

/** True where this thread can decode and encode without the DOM (always the case in a worker that can encode). */
export function canEncodeOffscreen(): boolean {
	return typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined';
}

/**
 * Decodes an image with its EXIF orientation baked in, shrinks its long side to `IMAGE_MAX_PX`
 * and writes it as WebP; browsers that can't write WebP (Safari) get JPEG instead of a PNG
 * stored under the wrong type. Runs in the encode worker, or on the page where workers can't.
 *
 * @see BUILD_PLAN §4.2; Decisions log "Phase 6 Q6–Q7"
 */
export async function encodeImage(source: Blob): Promise<Result<EncodedImage, string>> {
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
	} catch {
		return { ok: false, error: NOT_AN_IMAGE };
	}
	const { width, height } = fitWithin(bitmap.width, bitmap.height, IMAGE_MAX_PX);
	try {
		return await drawAndEncode(bitmap, width, height);
	} catch {
		// An oversized or odd image can make the canvas throw (RangeError, out of memory).
		return { ok: false, error: NOT_AN_IMAGE };
	} finally {
		bitmap.close();
	}
}

/** Draws the bitmap at the given size and writes WebP, else JPEG; never stores a blank image. */
async function drawAndEncode(
	bitmap: ImageBitmap,
	width: number,
	height: number
): Promise<Result<EncodedImage, string>> {
	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext('2d');
	if (!context) return { ok: false, error: CANNOT_ENCODE };
	context.drawImage(bitmap, 0, 0, width, height);
	const webp = await canvas.convertToBlob({ type: 'image/webp', quality: IMAGE_WEBP_QUALITY });
	if (webp.type === 'image/webp')
		return { ok: true, value: { blob: webp, width, height, mime: 'image/webp' } };
	const jpeg = await canvas.convertToBlob({ type: 'image/jpeg', quality: IMAGE_JPEG_QUALITY });
	if (jpeg.type === 'image/jpeg')
		return { ok: true, value: { blob: jpeg, width, height, mime: 'image/jpeg' } };
	return { ok: false, error: CANNOT_ENCODE };
}
