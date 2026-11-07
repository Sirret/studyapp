import { describe, expect, it } from 'vitest';
import { IMAGE_MAX_PX } from '#lib/config/defaults.ts';
import { fitWithin } from '#lib/import/image-size.ts';

describe('fitWithin', () => {
	it('shrinks a wide image so its long side is the maximum', () => {
		expect(fitWithin(IMAGE_MAX_PX * 2, IMAGE_MAX_PX, IMAGE_MAX_PX)).toEqual({
			width: IMAGE_MAX_PX,
			height: IMAGE_MAX_PX / 2
		});
	});

	it('shrinks a tall image the same way', () => {
		expect(fitWithin(IMAGE_MAX_PX, IMAGE_MAX_PX * 4, IMAGE_MAX_PX)).toEqual({
			width: IMAGE_MAX_PX / 4,
			height: IMAGE_MAX_PX
		});
	});

	it('leaves an image at exactly the maximum alone', () => {
		expect(fitWithin(IMAGE_MAX_PX, 10, IMAGE_MAX_PX)).toEqual({ width: IMAGE_MAX_PX, height: 10 });
	});

	it('never enlarges a small image', () => {
		expect(fitWithin(40, 20, IMAGE_MAX_PX)).toEqual({ width: 40, height: 20 });
	});

	it('never rounds a thin side down to nothing', () => {
		expect(fitWithin(IMAGE_MAX_PX * 100, 1, IMAGE_MAX_PX)).toEqual({
			width: IMAGE_MAX_PX,
			height: 1
		});
	});
});
