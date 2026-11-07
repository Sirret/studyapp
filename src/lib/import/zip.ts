import { unzipSync } from 'fflate';
import type { Result } from '#lib/util/result.ts';

const IMAGE_MIMES: ReadonlyMap<string, string> = new Map([
	['png', 'image/png'],
	['jpg', 'image/jpeg'],
	['jpeg', 'image/jpeg'],
	['webp', 'image/webp'],
	['gif', 'image/gif'],
	['bmp', 'image/bmp']
]);

/** A file taken out of a zip. */
export interface ZipImage {
	name: string;
	bytes: Uint8Array;
	mime: string;
}

/** The contents of an import zip. */
export interface ImportZip {
	text: string;
	images: ZipImage[];
}

function baseName(path: string): string {
	return path.split(/[\\/]/).at(-1) ?? path;
}

function extensionOf(name: string): string {
	return name.split('.').at(-1)?.toLowerCase() ?? '';
}

/** Folder entries, hidden files, and what macOS adds to every zip it makes. */
function isIgnored(path: string): boolean {
	return path.endsWith('/') || path.startsWith('__MACOSX/') || baseName(path).startsWith('.');
}

function readText(path: string, bytes: Uint8Array): Result<string, string> {
	try {
		return { ok: true, value: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
	} catch {
		return { ok: false, error: `${baseName(path)} is not UTF-8 text.` };
	}
}

function unzip(bytes: Uint8Array): Result<Record<string, Uint8Array>, string> {
	try {
		return { ok: true, value: unzipSync(bytes) };
	} catch {
		return { ok: false, error: 'This file could not be read as a zip.' };
	}
}

/**
 * Reads a `.zip` holding one `.txt` and its images. Other files are ignored.
 *
 * @see BUILD_PLAN §4.2
 */
export function readImportZip(bytes: Uint8Array): Result<ImportZip, string> {
	const files = unzip(bytes);
	if (!files.ok) return files;
	const entries = Object.entries(files.value).filter(([path]) => !isIgnored(path));
	const texts = entries.filter(([path]) => extensionOf(path) === 'txt');
	const [first] = texts;
	if (!first) return { ok: false, error: 'This zip has no .txt file.' };
	if (texts.length > 1) {
		const names = texts.map(([path]) => baseName(path)).join(', ');
		return { ok: false, error: `This zip has more than one .txt file: ${names}.` };
	}
	const text = readText(first[0], first[1]);
	if (!text.ok) return text;
	const images = entries.flatMap(([path, content]): ZipImage[] => {
		const mime = IMAGE_MIMES.get(extensionOf(path));
		return mime ? [{ name: baseName(path), bytes: content, mime }] : [];
	});
	return { ok: true, value: { text: text.value, images } };
}

/** How a file name is matched against `@occlusion` and diagram `source:` lines. @see BUILD_PLAN §4.2 */
export function fileKey(name: string): string {
	return baseName(name).toLowerCase();
}
