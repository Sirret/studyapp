import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BlockSchema, type Block } from '#lib/import/ast.ts';
import { parseImport } from '#lib/import/parser.ts';

function blockOf<K extends Block['kind']>(text: string, kind: K): Extract<Block, { kind: K }> {
	const { document, errors } = parseImport(text);
	expect(errors).toEqual([]);
	const block = document.blocks.find((candidate) => candidate.kind === kind);
	if (!block) throw new Error(`No ${kind} block`);
	return block as Extract<Block, { kind: K }>;
}

describe('parseImport', () => {
	describe('lines', () => {
		it('ignores blank lines but keeps real line numbers', () => {
			const { document } = parseImport('\n\n@deck A\n\n\n@fact\n\nx :: y\n');
			expect(document.blocks.map((block) => block.line)).toEqual([3, 6]);
			const fact = document.blocks[1];
			expect(fact?.kind === 'fact' && fact.entries[0]?.line).toBe(8);
		});

		it('reads CRLF, CR and LF line endings alike', () => {
			const { document, errors } = parseImport('@deck A\r\n@fact\rx :: y\nz :: w');
			expect(errors).toEqual([]);
			expect(document.blocks.map((block) => block.kind)).toEqual(['deck', 'fact']);
		});

		it('ignores a byte order mark at the start of a file', () => {
			expect(blockOf('﻿@deck A', 'deck').name).toBe('A');
		});

		it('trims indentation before reading a line', () => {
			expect(blockOf('   @deck   Spaced name  ', 'deck').name).toBe('Spaced name');
		});

		it('returns nothing for empty text', () => {
			expect(parseImport('')).toEqual({ document: { blocks: [] }, errors: [] });
		});
	});

	describe('directives', () => {
		it('treats directive names as case-sensitive', () => {
			expect(parseImport('@Fact').errors[0]?.line).toBe(1);
		});

		it.each(['constructor', 'toString', '__proto__'])(
			'reports @%s as unknown rather than finding it on an object',
			(name) => {
				expect(parseImport(`@${name}`).errors).toEqual([
					{ line: 1, message: `Unknown directive @${name}; the lines under it were skipped.` }
				]);
			}
		);

		it('reports a lone @ as unknown', () => {
			expect(parseImport('@').errors[0]?.line).toBe(1);
		});

		it('reads @priority high and normal', () => {
			expect(blockOf('@priority high', 'priority').value).toBe('high');
			expect(blockOf('@priority normal', 'priority').value).toBe('normal');
		});
	});

	describe('term :: definition lines', () => {
		it('splits on the first spaced :: so code in a term or definition survives', () => {
			const { entries } = blockOf('@fact\nstd::vector :: like std::array :: but growable', 'fact');
			expect(entries[0]).toMatchObject({
				left: 'std::vector',
				right: 'like std::array :: but growable'
			});
		});

		it('rejects :: with no spaces around it', () => {
			expect(parseImport('@fact\nstd::vector').errors[0]?.line).toBe(2);
		});

		it('makes one entry per line in @keyterms and @scenario', () => {
			expect(blockOf('@keyterms\na :: b\nc :: d', 'keyterms').entries).toHaveLength(2);
			expect(blockOf('@scenario\na :: b\nc :: d', 'scenario').entries).toHaveLength(2);
		});

		it('reports a block with no lines', () => {
			expect(parseImport('@fact').errors).toEqual([{ line: 1, message: '@fact has no lines.' }]);
		});
	});

	describe('[CHECK]', () => {
		it('flags only the entry whose line has it, and strips the marker', () => {
			const { entries } = blockOf('@fact\na :: b [CHECK]\nc :: d', 'fact');
			expect(entries[0]).toMatchObject({ right: 'b', isChecked: true });
			expect(entries[1]).toMatchObject({ right: 'd', isChecked: false });
		});

		it('flags a whole block when any of its lines has it', () => {
			const sequence = blockOf('@sequence S\none\ntwo [CHECK]', 'sequence');
			expect(sequence).toMatchObject({ steps: ['one', 'two'], isChecked: true });
		});

		it('flags a block when its directive line has it, and strips it from the name', () => {
			const sequence = blockOf('@sequence S [CHECK]\none\ntwo', 'sequence');
			expect(sequence).toMatchObject({ name: 'S', isChecked: true });
		});

		it('flags @read, @compare, @example, @diagram and @occlusion', () => {
			expect(blockOf('@read\ntext [CHECK]', 'read').isChecked).toBe(true);
			expect(blockOf('@compare\n| | A | B |\n| x | 1 | 2 | [CHECK]', 'compare').isChecked).toBe(
				true
			);
			expect(blockOf('@example E\na :: b\nc :: d [CHECK]', 'example').isChecked).toBe(true);
			expect(blockOf('@diagram flow F\nA -> B : ??? [CHECK]', 'diagramFlow').isChecked).toBe(true);
			expect(blockOf('@diagram stack S\nA\nB [CHECK]', 'diagramStack').isChecked).toBe(true);
			expect(blockOf('@occlusion a.png [CHECK]', 'occlusion')).toMatchObject({
				file: 'a.png',
				isChecked: true
			});
		});

		it('strips the marker from a cloze', () => {
			const { entries } = blockOf('@cloze\nA {{b}} c [CHECK]', 'cloze');
			expect(entries[0]).toMatchObject({ text: 'A {{b}} c', isChecked: true });
		});

		it('strips the marker from directives that cannot hold it', () => {
			expect(blockOf('@deck A [CHECK]', 'deck').name).toBe('A');
			expect(blockOf('@tag t [CHECK]', 'tag').name).toBe('t');
			expect(blockOf('@coverage\na, b [CHECK]', 'coverage').sections).toEqual(['a', 'b']);
		});
	});

	describe('@read', () => {
		it('keeps its lines in order, joined by newlines', () => {
			expect(blockOf('@read\none\n\ntwo', 'read')).toMatchObject({
				text: 'one\ntwo',
				isGenerated: false
			});
		});

		it('reads and strips a [GENERATED] prefix', () => {
			expect(blockOf('@read\n[GENERATED] one\ntwo', 'read')).toMatchObject({
				text: 'one\ntwo',
				isGenerated: true
			});
		});

		it('only treats [GENERATED] as a prefix', () => {
			expect(blockOf('@read\none [GENERATED] two', 'read').isGenerated).toBe(false);
		});

		it('reports a [GENERATED] prefix with no text', () => {
			expect(parseImport('@read\n[GENERATED]').errors).toEqual([
				{ line: 1, message: '@read has no text.' }
			]);
		});
	});

	describe('@cloze', () => {
		it('makes one entry per line, keeping the braces', () => {
			const { entries } = blockOf('@cloze\n{{a}} and {{b}}\n{{c}}', 'cloze');
			expect(entries.map((entry) => entry.text)).toEqual(['{{a}} and {{b}}', '{{c}}']);
		});

		it.each(['a}} b', '{{a{{b}}', '{{a}} {{', '}}{{'])(
			'rejects unbalanced braces in %s',
			(line) => {
				expect(parseImport(`@cloze\n${line}`).errors[0]?.line).toBe(2);
			}
		);
	});

	describe('@compare', () => {
		it('reads the first row as item names and ignores its corner cell', () => {
			const compare = blockOf('@compare\n| corner | A | B |\n| size | 1 | 2 |', 'compare');
			expect(compare).toMatchObject({
				items: ['A', 'B'],
				rows: [{ attribute: 'size', values: ['1', '2'] }]
			});
		});

		it('skips Markdown separator rows', () => {
			const compare = blockOf('@compare\n| | A | B |\n|---|:--:|---|\n| x | 1 | 2 |', 'compare');
			expect(compare.rows).toHaveLength(1);
		});

		it('allows a row with no closing pipe', () => {
			expect(blockOf('@compare\n| | A | B\n| x | 1 | 2', 'compare').rows).toHaveLength(1);
		});

		it('rejects an empty cell', () => {
			expect(parseImport('@compare\n| | A | B |\n| x | | 2 |').errors).toEqual([
				{ line: 3, message: 'A table cell is empty. The @compare block was skipped.' }
			]);
		});

		it('rejects a table with one item or with no rows', () => {
			expect(parseImport('@compare\n| | A |\n| x | 1 |').errors[0]?.line).toBe(1);
			expect(parseImport('@compare\n| | A | B |').errors[0]?.line).toBe(1);
		});
	});

	describe('@diagram', () => {
		it('reads a stack, with an optional role', () => {
			expect(
				blockOf('@diagram stack OSI\nApp\nTransport :: delivery', 'diagramStack')
			).toMatchObject({
				name: 'OSI',
				layers: [{ label: 'App' }, { label: 'Transport', role: 'delivery' }]
			});
		});

		it('reads a flow, with an optional label', () => {
			const flow = blockOf('@diagram flow Q\nA b -> C d : e f\nC d->G\nG -> H :', 'diagramFlow');
			expect(flow.edges).toEqual([
				{ from: 'A b', to: 'C d', label: 'e f' },
				{ from: 'C d', to: 'G' },
				{ from: 'G', to: 'H' }
			]);
		});

		it('keeps a colon that is not a label separator', () => {
			const flow = blockOf('@diagram flow Q\nA -> http://b', 'diagramFlow');
			expect(flow.edges).toEqual([{ from: 'A', to: 'http://b' }]);
		});

		it('reads a source: line as the image it was drawn from', () => {
			expect(blockOf('@diagram stack S\nsource: s.png\nA\nB', 'diagramStack').sourceFile).toBe(
				's.png'
			);
			expect(blockOf('@diagram flow F\nA -> B\nsource: f.png', 'diagramFlow').sourceFile).toBe(
				'f.png'
			);
		});

		it('rejects a stack with one layer or a flow with no arrows', () => {
			expect(parseImport('@diagram stack S\nA').errors[0]?.line).toBe(1);
			expect(parseImport('@diagram flow F').errors[0]?.line).toBe(1);
		});

		it('rejects an arrow with an empty end', () => {
			expect(parseImport('@diagram flow F\n-> B').errors[0]?.line).toBe(2);
			expect(parseImport('@diagram flow F\nA ->').errors[0]?.line).toBe(2);
		});
	});

	describe('@coverage', () => {
		it('splits on commas across its lines and drops empties', () => {
			expect(blockOf('@coverage\na, b,, c\nd', 'coverage').sections).toEqual(['a', 'b', 'c', 'd']);
		});
	});

	describe('robustness', () => {
		const lineArbitrary = fc.oneof(
			fc.string(),
			fc.constantFrom(
				'@deck A',
				'@fact',
				'@cloze',
				'@compare',
				'@read',
				'@diagram flow F',
				'@sequence',
				'| a | b |',
				'a :: b',
				'A -> B',
				'{{a}}',
				'[CHECK]',
				'[GENERATED]'
			)
		);

		it('never throws, and everything it returns is a valid block with a real line number', () => {
			fc.assert(
				fc.property(fc.array(lineArbitrary), (lines) => {
					const { document, errors } = parseImport(lines.join('\n'));
					for (const block of document.blocks) expect(() => BlockSchema.parse(block)).not.toThrow();
					for (const error of errors) {
						expect(error.line).toBeGreaterThanOrEqual(1);
						expect(error.message).not.toBe('');
					}
				})
			);
		});

		it('gives the same output for the same text', () => {
			const text = '@deck A\nbad\n@fact\nx :: y';
			expect(parseImport(text)).toEqual(parseImport(text));
		});
	});
});

describe('@end (Decisions log: import preview)', () => {
	it('closes a reply without an error or a note', () => {
		const { document, errors } = parseImport('@deck A\n@fact\nTCP :: reliable\n@end');
		expect(errors).toStrictEqual([]);
		expect(document.blocks.map((block) => block.kind)).toStrictEqual(['deck', 'fact', 'end']);
	});

	it('takes no argument', () => {
		expect(parseImport('@deck A\n@end now').errors).toHaveLength(1);
	});
});
