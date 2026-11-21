import { readFileSync } from 'node:fs';
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

		// PROMPTS §7: an empty paste gives no errors and no warnings ("Nothing to import").
		it('returns nothing for empty text', () => {
			expect(parseImport('')).toEqual({ document: { blocks: [] }, errors: [], warnings: [] });
		});
	});

	describe('directives', () => {
		// PROMPTS §7: directive names are case-insensitive, and no warning is given.
		it('treats directive names as case-insensitive', () => {
			const output = parseImport('@DECK Lecture 1\n@FACT\nterm :: definition');
			expect(output.errors).toEqual([]);
			expect(output.warnings).toEqual([]);
		});

		// PROMPTS §7: unknown directives are skipped with a warning, never an error, with the lines under them.
		it.each(['constructor', 'toString', '__proto__'])(
			'warns on @%s as unknown rather than finding it on an object',
			(name) => {
				const output = parseImport(`@${name}\nterm :: definition`);
				expect(output.errors).toEqual([]);
				expect(output.warnings).toEqual([
					{
						line: 1,
						message: `Unknown directive @${name}; it and the lines under it were skipped.`
					}
				]);
				expect(output.document.blocks).toEqual([]);
			}
		);

		// PROMPTS §7: a lone "@" is an unknown directive.
		it('warns on a lone @ as unknown', () => {
			const output = parseImport('@');
			expect(output.errors).toEqual([]);
			expect(output.warnings[0]?.line).toBe(1);
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
			expect(blockOf('@occlusion a.png\nbox: Disk [CHECK]', 'occlusion').isChecked).toBe(true);
		});

		/** @see Decisions log "Phase 6 step 6" */
		it('reads box: lines under @occlusion and reports any other line', () => {
			expect(blockOf('@occlusion a.png\nbox: Disk\nbox:  Buffer ', 'occlusion').labels).toEqual([
				'Disk',
				'Buffer'
			]);
			const { document, errors } = parseImport('@occlusion a.png\nDisk\nbox: CPU');
			expect(errors).toEqual([
				{ line: 2, message: 'Under @occlusion, write only "box: <label>" lines.' }
			]);
			expect(document.blocks[0]).toMatchObject({ kind: 'occlusion', labels: ['CPU'] });
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

/** @see docs/PROMPTS.md §3 FORMAT and §7 */
describe('Import v2 directives', () => {
	it('reads @map as the course name', () => {
		expect(blockOf('@map Network Security', 'map').name).toBe('Network Security');
	});

	it('reads the lines under @bigpicture and the questions under @habit', () => {
		expect(blockOf('@bigpicture\nA leads to B.\nB leads to C.', 'bigpicture').lines).toEqual([
			'A leads to B.',
			'B leads to C.'
		]);
		expect(blockOf('@habit\nWhich layer?\nWhich device?', 'habit').questions).toEqual([
			'Which layer?',
			'Which device?'
		]);
	});

	it('reads @topic with section lines under it as a map entry', () => {
		const topic = blockOf('@topic osi The OSI Model | from: Lecture I\nLayers\nPDUs', 'topic');
		expect(topic).toMatchObject({
			key: 'osi',
			title: 'The OSI Model',
			sections: ['Layers', 'PDUs']
		});
		expect(topic.from).toHaveLength(1);
	});

	it('reads @topic with no lines under it as a content topic, with or without from:', () => {
		expect(blockOf('@topic osi The OSI Model', 'topic')).toMatchObject({
			key: 'osi',
			title: 'The OSI Model',
			sections: [],
			from: []
		});
	});

	it('splits each @links line at the first " : " only', () => {
		expect(
			blockOf('@links\na -> b : needs b: really : yes\nb -> c : feeds', 'links').links
		).toEqual([
			{ from: 'a', to: 'b', how: 'needs b: really : yes' },
			{ from: 'b', to: 'c', how: 'feeds' }
		]);
	});

	it('reads @cheat as a named table with column names and rows', () => {
		const cheat = blockOf('@cheat Layers\n| | PDU | Device |\n| L2 | Frame | Switch |', 'cheat');
		expect(cheat).toMatchObject({ name: 'Layers', items: ['PDU', 'Device'] });
		expect(cheat.rows).toEqual([{ attribute: 'L2', values: ['Frame', 'Switch'] }]);
	});

	it('reads @missing lines, and "none" as nothing missing', () => {
		expect(blockOf('@missing\nSlide 3: a diagram\nSlide 9: blank', 'missing').items).toHaveLength(
			2
		);
		expect(blockOf('@missing\nnone', 'missing').items).toEqual([]);
	});

	it('reads @summary, @section and @tip', () => {
		expect(blockOf('@summary\nLine one.\nLine two.', 'summary').text).toContain('Line two.');
		expect(blockOf('@section Layers and PDUs', 'section').title).toBe('Layers and PDUs');
		expect(blockOf('@tip\nAll People Seem To Need Data Processing', 'tip').text).toContain(
			'People'
		);
	});

	it('reads @link as a topic key with question :: answer entries', () => {
		const link = blockOf('@link osi\nWhy does X need Y? :: because Z', 'link');
		expect(link.topicKey).toBe('osi');
		expect(link.entries).toMatchObject([{ left: 'Why does X need Y?', right: 'because Z' }]);
	});

	it('reads @next as a topic key with an optional section title', () => {
		expect(blockOf('@next osi Layers and PDUs', 'next')).toMatchObject({
			topicKey: 'osi',
			section: 'Layers and PDUs'
		});
		expect(blockOf('@next osi', 'next').section).toBeUndefined();
	});

	it('makes the @compare title optional', () => {
		const compare = blockOf('@compare\n| | TCP | UDP |\n| order | yes | no |', 'compare');
		expect(compare.name).toBeUndefined();
		expect(compare.items).toEqual(['TCP', 'UDP']);
	});

	it('reads [ADDED] like [GENERATED] on @read, and at the end of a card line', () => {
		expect(blockOf('@read\n[ADDED] Extra text.', 'read')).toMatchObject({
			text: 'Extra text.',
			isGenerated: true
		});
		expect(blockOf('@fact\nA :: b [ADDED]', 'fact').entries[0]).toMatchObject({
			right: 'b',
			isAdded: true
		});
	});

	it('keeps [CHECK] as an alias of the old marker', () => {
		expect(blockOf('@fact\nA :: b [CHECK]', 'fact').entries[0]?.isChecked).toBe(true);
	});

	it('reads mixed-case names the same as lowercase', () => {
		const strip = (text: string) => parseImport(text).document.blocks.map(({ kind }) => kind);
		expect(strip('@Topic a A\n@SECTION S\n@Fact\nx :: y')).toEqual(
			strip('@topic a A\n@section S\n@fact\nx :: y')
		);
	});

	it('ignores ``` lines and everything before the first @ line', () => {
		const output = parseImport('Sure! Here you go:\n```\n@map M\n@end\n```');
		expect(output.errors).toEqual([]);
		expect(output.document.blocks.map(({ kind }) => kind)).toEqual(['map', 'end']);
		// SPEC-GAP: PROMPTS §7 says to ignore a preamble; is it also a warning? (the golden file expects one)
		expect(output.warnings.map(({ line }) => line)).toEqual([1]);
	});

	it('gives no warning for ``` lines alone', () => {
		expect(parseImport('```\n@map M\n```').warnings).toEqual([]);
	});

	it('skips the lines under an unknown directive until the next known directive', () => {
		const output = parseImport('@fact\na :: 1\n@bogus\nb :: 2\n@fact\nc :: 3');
		const facts = output.document.blocks.flatMap((block) => (block.kind === 'fact' ? [block] : []));
		expect(facts.map((fact) => fact.entries.map((entry) => entry.left))).toEqual([['a'], ['c']]);
		expect(output.errors).toEqual([]);
		expect(output.warnings).toHaveLength(1);
	});
});

describe('Import v2 fixtures', () => {
	const read = (name: string) => readFileSync(`tests/fixtures/import/${name}`, 'utf8');

	it('parses the security reply with no errors and no warnings', () => {
		const output = parseImport(read('security_reply.txt'));
		expect(output.errors).toEqual([]);
		expect(output.warnings).toEqual([]);
	});

	it('parses the datacomms reply with no errors; its @exam blocks are only warnings', () => {
		const text = read('datacomms_reply.txt');
		const output = parseImport(text);
		expect(output.errors).toEqual([]);
		const exams = text.split('\n').filter((line) => line.startsWith('@exam')).length;
		expect(output.warnings).toHaveLength(exams);
		for (const warning of output.warnings) expect(warning.message).toContain('@exam');
	});
});
