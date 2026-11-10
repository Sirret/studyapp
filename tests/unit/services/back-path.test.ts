import { describe, expect, it } from 'vitest';
import { safeBackPath } from '#lib/services/back-path.ts';

const ORIGIN = 'https://snowpack.example';

describe('safeBackPath (study page ?back=)', () => {
	it('keeps an in-app path with its query', () => {
		expect(safeBackPath('/learn/c1/chunk:x?step=2&quiz=s1', ORIGIN)).toBe(
			'/learn/c1/chunk:x?step=2&quiz=s1'
		);
		expect(safeBackPath('/course/c1?done=review', ORIGIN)).toBe('/course/c1?done=review');
	});

	it.each([
		['missing', null],
		['empty', ''],
		['relative', 'course/c1'],
		['protocol-relative', '//evil.example/x'],
		['backslash', '/\\evil.example'],
		['encoded backslash', '/%5Cevil.example'],
		['absolute URL', 'https://evil.example/'],
		['javascript', 'javascript:alert(1)'],
		['control character', '/\tevil']
	])('rejects a %s target', (_name, back) => {
		const result = safeBackPath(back, ORIGIN);
		if (result !== null) expect(new URL(result, ORIGIN).origin).toBe(ORIGIN);
		else expect(result).toBeNull();
	});

	it('rejects the clear escapes outright', () => {
		for (const back of ['//evil.example/x', '/\\evil.example', 'https://evil.example/']) {
			expect(safeBackPath(back, ORIGIN)).toBeNull();
		}
	});
});
