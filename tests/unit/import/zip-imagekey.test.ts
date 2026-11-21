import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { imageKey, readImportZip } from '#lib/import/zip.ts';

/**
 * Image file matching for `@occlusion` and diagram `source:` lines. The key ignores case, spaces,
 * underscores, hyphens and the extension, and drops folders. Two images in one zip with the same
 * key are an import error naming both files.
 *
 * @see BUILD_PLAN §4.2; Decisions log "Phase 6 Q9"
 */

const PIXELS = new Uint8Array([1, 2, 3]);

describe('imageKey', () => {
	it('gives the same key to Slide 12.PNG and slide_12.jpg', () => {
		expect(imageKey('Slide 12.PNG')).toBe(imageKey('slide_12.jpg'));
	});

	it('ignores case', () => {
		expect(imageKey('SLIDE12.png')).toBe(imageKey('slide12.png'));
	});

	it('ignores spaces, including repeated ones', () => {
		expect(imageKey('Slide   12.png')).toBe(imageKey('slide12.png'));
	});

	it('ignores underscores and hyphens, and mixes of them', () => {
		const key = imageKey('slide12a.png');
		expect(imageKey('slide_12a.png')).toBe(key);
		expect(imageKey('slide-12a.webp')).toBe(key);
		expect(imageKey('Slide - 12_A.jpeg')).toBe(key);
	});

	it('ignores the extension, whatever it is', () => {
		const key = imageKey('diagram.png');
		expect(imageKey('diagram.JPG')).toBe(key);
		expect(imageKey('diagram.webp')).toBe(key);
		expect(imageKey('diagram.gif')).toBe(key);
	});

	it('drops folders from the path', () => {
		expect(imageKey('images/week 3/Slide 12.png')).toBe(imageKey('slide_12.jpg'));
	});

	it('drops folders written with Windows separators too', () => {
		expect(imageKey('week3\\Slide 12.png')).toBe(imageKey('slide_12.jpg'));
	});

	it('keeps different numbers apart', () => {
		expect(imageKey('slide 12.png')).not.toBe(imageKey('slide 13.png'));
	});

	it('keeps different names apart', () => {
		expect(imageKey('slide 12.png')).not.toBe(imageKey('slide 12b.png'));
		expect(imageKey('btree.png')).not.toBe(imageKey('bplustree.png'));
	});

	it('treats a name without an extension as its base name', () => {
		// SPEC-GAP: the spec does not say what an extensionless name gives; read as the same key
		// as its base name with the ignored characters removed.
		expect(imageKey('slide_12')).toBe(imageKey('Slide 12.png'));
	});

	it('is deterministic: the same name always gives the same key', () => {
		expect(imageKey('Slide 12.PNG')).toBe(imageKey('Slide 12.PNG'));
	});

	it('returns a string', () => {
		expect(typeof imageKey('Slide 12.PNG')).toBe('string');
	});

	it('keeps dots inside the base name (only the final extension is removed)', () => {
		// SPEC-GAP: the spec says "without the extension" but is silent on dots inside the base
		// name. Read as "only the final extension goes", so `slide.12.png` keeps its dot.
		expect(imageKey('slide.12.png')).toBe(imageKey('slide.12.jpg'));
		expect(imageKey('slide.12.png')).not.toBe(imageKey('slide12.png'));
	});
});

describe('readImportZip image name collisions', () => {
	it('reports an error naming both files when two images share a key', () => {
		const result = readImportZip(
			zipSync({
				'notes.txt': strToU8('@deck A'),
				'Slide 12.PNG': PIXELS,
				'slide_12.jpg': PIXELS
			})
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain('Slide 12.PNG');
		expect(result.error).toContain('slide_12.jpg');
	});

	it('treats two same-named images in different folders as a collision', () => {
		const result = readImportZip(
			zipSync({
				'notes.txt': strToU8('@deck A'),
				'week1/slide-12.png': PIXELS,
				'week2/Slide_12.png': PIXELS
			})
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain('slide-12.png');
		expect(result.error).toContain('Slide_12.png');
	});

	it('accepts images whose keys differ', () => {
		const result = readImportZip(
			zipSync({
				'notes.txt': strToU8('@deck A'),
				'slide 12.png': PIXELS,
				'slide 13.png': PIXELS
			})
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.images.map((image) => image.name)).toEqual([
			'slide 12.png',
			'slide 13.png'
		]);
	});

	it('does not count a non-image file as a collision', () => {
		// SPEC-GAP: the spec says "two images in one zip"; a PDF or other non-image sharing a key
		// is read as ignored (not an image), so it must not block the import.
		const result = readImportZip(
			zipSync({
				'notes.txt': strToU8('@deck A'),
				'slide 12.png': PIXELS,
				'slide_12.pdf': PIXELS
			})
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.images.map((image) => image.name)).toEqual(['slide 12.png']);
	});

	it('ignores __MACOSX entries when checking for collisions', () => {
		const result = readImportZip(
			zipSync({
				'notes.txt': strToU8('@deck A'),
				'slide 12.png': PIXELS,
				'__MACOSX/._slide 12.png': strToU8('junk'),
				'__MACOSX/slide_12.png': strToU8('junk')
			})
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.images.map((image) => image.name)).toEqual(['slide 12.png']);
	});

	it('keeps the original file names on the images it returns', () => {
		const result = readImportZip(
			zipSync({
				'notes.txt': strToU8('@deck A'),
				'lecture/Slide 12.PNG': PIXELS
			})
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.images[0]?.name).toBe('Slide 12.PNG');
	});
});
