import type { Result } from '#lib/util/result.ts';

/** A file taken out of a zip. */
export interface ZipImage {
	name: string;
	bytes: Uint8Array<ArrayBuffer>;
	mime: string;
}

/** The contents of an import zip. */
export interface ImportZip {
	text: string;
	images: ZipImage[];
}

/**
 * Reads a `.zip` holding one `.txt` and its images. Other files are ignored.
 *
 * @see BUILD_PLAN §4.2
 */
export function readImportZip(_bytes: Uint8Array): Result<ImportZip, string> {
	throw new Error('not implemented');
}

/** How a file name is matched against `@occlusion` and diagram `source:` lines. @see BUILD_PLAN §4.2 */
export function fileKey(_name: string): string {
	throw new Error('not implemented');
}
