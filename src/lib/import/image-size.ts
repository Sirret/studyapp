/**
 * The size an image should be stored at: its long side at most `maxPx`, never enlarged.
 *
 * @see BUILD_PLAN §4.2
 */
export function fitWithin(
	width: number,
	height: number,
	maxPx: number
): { width: number; height: number } {
	const scale = Math.min(1, maxPx / Math.max(width, height));
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	};
}
