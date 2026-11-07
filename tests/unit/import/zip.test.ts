import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readImportZip } from '#lib/import/zip.ts';

const PIXELS = new Uint8Array([1, 2, 3]);

describe('readImportZip', () => {
	it('reads one text file and its images, with folders dropped from the names', () => {
		const result = readImportZip(
			zipSync({
				'lecture/notes.txt': strToU8('@deck A'),
				'lecture/images/slide.png': PIXELS,
				'photo.JPG': PIXELS
			})
		);
		if (!result.ok) throw new Error(result.error);
		expect(result.value.text).toBe('@deck A');
		expect(result.value.images.map(({ name, mime }) => [name, mime])).toEqual([
			['slide.png', 'image/png'],
			['photo.JPG', 'image/jpeg']
		]);
		expect(result.value.images[0]?.bytes).toEqual(PIXELS);
	});

	it.each([
		['webp', 'image/webp'],
		['jpeg', 'image/jpeg'],
		['gif', 'image/gif']
	])('recognises .%s images', (extension, mime) => {
		const result = readImportZip(zipSync({ 'a.txt': strToU8('x'), [`b.${extension}`]: PIXELS }));
		expect(result.ok && result.value.images[0]?.mime).toBe(mime);
	});

	it('ignores other files, folder entries and the extras that macOS adds', () => {
		const result = readImportZip(
			zipSync({
				'a.txt': strToU8('x'),
				'readme.pdf': PIXELS,
				'folder/': new Uint8Array(),
				'__MACOSX/._a.txt': strToU8('junk'),
				'__MACOSX/._b.png': PIXELS,
				'.hidden.txt': strToU8('junk')
			})
		);
		if (!result.ok) throw new Error(result.error);
		expect(result.value).toEqual({ text: 'x', images: [] });
	});

	it('fails when there is no text file', () => {
		expect(readImportZip(zipSync({ 'b.png': PIXELS }))).toEqual({
			ok: false,
			error: 'This zip has no .txt file.'
		});
	});

	it('fails when there are two text files', () => {
		expect(readImportZip(zipSync({ 'a.txt': strToU8('x'), 'b.txt': strToU8('y') }))).toEqual({
			ok: false,
			error: 'This zip has more than one .txt file: a.txt, b.txt.'
		});
	});

	it('fails on a file that is not a zip', () => {
		expect(readImportZip(strToU8('not a zip'))).toEqual({
			ok: false,
			error: 'This file could not be read as a zip.'
		});
	});

	it('fails when the text is not UTF-8', () => {
		expect(readImportZip(zipSync({ 'a.txt': new Uint8Array([0xff, 0xfe, 0xfa]) }))).toEqual({
			ok: false,
			error: 'a.txt is not UTF-8 text.'
		});
	});
});
