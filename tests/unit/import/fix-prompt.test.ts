import { describe, expect, it } from 'vitest';
import { buildFixPrompt } from '#lib/import/fix-prompt.ts';

const SOURCE = '@deck A\n@fact\nTCP :: reliable\n@sequence S\nonly one step\n@cloze\nno blanks';

/** BUILD_PLAN §10 row 8.5 ("copy a fix-it prompt for skipped parts"); PROMPTS.md. */
describe('buildFixPrompt', () => {
	it('is null when nothing was skipped', () => {
		expect(buildFixPrompt([], SOURCE)).toBeNull();
	});

	it('quotes each skipped line with its reason', () => {
		const prompt = buildFixPrompt(
			[
				{ line: 4, message: 'A sequence needs at least 2 steps.' },
				{ line: 7, message: 'A cloze needs a {{blank}}.' }
			],
			SOURCE
		);
		expect(prompt).toContain('@sequence S');
		expect(prompt).toContain('A sequence needs at least 2 steps.');
		expect(prompt).toContain('no blanks');
		expect(prompt).toContain('A cloze needs a {{blank}}.');
		expect(prompt).not.toContain('TCP :: reliable');
	});

	it('lists the skipped parts in line order', () => {
		const prompt =
			buildFixPrompt(
				[
					{ line: 7, message: 'second' },
					{ line: 4, message: 'first' }
				],
				SOURCE
			) ?? '';
		expect(prompt.indexOf('first')).toBeLessThan(prompt.indexOf('second'));
	});

	it('asks for only those parts again in the import format, ending in @end', () => {
		const prompt = buildFixPrompt([{ line: 5, message: 'Too short.' }], SOURCE) ?? '';
		expect(prompt).toMatch(/only/i);
		expect(prompt).toContain('@end');
	});

	it('still gives the reason when the line is outside the text', () => {
		const prompt = buildFixPrompt([{ line: 99, message: 'The reply stopped here.' }], SOURCE);
		expect(prompt).toContain('The reply stopped here.');
	});
});
