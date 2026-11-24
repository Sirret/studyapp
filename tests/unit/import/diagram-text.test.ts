import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { mergeDiagram, nodeKey, type DiagramStructure } from '#lib/engine/diagram-edit.ts';
import { formatDiagram, parseDiagramText } from '#lib/import/diagram-parser.ts';

const NUM_RUNS = 100;
const uuid = (n: number): string => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

const parse = (kind: 'stack' | 'flow', ...lines: string[]) =>
	parseDiagramText(kind, lines.join('\n'));

// ---------------------------------------------------------------------------------------------

describe('parseDiagramText: stack (BUILD_PLAN §4.1, §7.2)', () => {
	it('reads one layer per line, top to bottom', () => {
		const { parsed, errors } = parse('stack', 'Application', 'Transport', 'Network');
		expect(errors).toEqual([]);
		expect(parsed).toEqual({
			kind: 'stack',
			layers: [{ label: 'Application' }, { label: 'Transport' }, { label: 'Network' }]
		});
	});

	it('reads "label :: role"', () => {
		const { parsed } = parse('stack', 'Application :: HTTP, DNS', 'Transport :: TCP, UDP');
		expect(parsed).toEqual({
			kind: 'stack',
			layers: [
				{ label: 'Application', role: 'HTTP, DNS' },
				{ label: 'Transport', role: 'TCP, UDP' }
			]
		});
	});

	it('ignores blank lines and trims each line', () => {
		const { parsed, errors } = parse('stack', '', '  Application  ', '', '   ', 'Transport', '');
		expect(errors).toEqual([]);
		expect(parsed).toEqual({
			kind: 'stack',
			layers: [{ label: 'Application' }, { label: 'Transport' }]
		});
	});

	it('rejects a repeated label, naming the line (1-based, blank lines counted)', () => {
		const { parsed, errors } = parse('stack', '', 'Application', 'Transport', 'Application');
		expect(parsed).toBeNull();
		expect(errors).toHaveLength(1);
		expect(errors[0]?.line).toBe(4);
		expect(errors[0]?.message).toContain('Layer "Application" is listed twice.');
	});

	it('needs at least two layers (MIN_STACK_LAYERS)', () => {
		for (const text of ['', '\n\n', 'Application']) {
			const { parsed, errors } = parseDiagramText('stack', text);
			expect(parsed).toBeNull();
			expect(errors.length).toBeGreaterThan(0);
		}
	});

	it('does not allow a source: line (the editor keeps the source image)', () => {
		const { parsed, errors } = parse('stack', 'Application', 'source: slide12.png', 'Transport');
		expect(parsed).toBeNull();
		expect(errors.map((e) => e.line)).toContain(2);
	});
});

describe('parseDiagramText: flow', () => {
	it('reads "A -> B" and "A -> B : label"', () => {
		const { parsed, errors } = parse(
			'flow',
			'Parser -> Optimizer : relational algebra',
			'Optimizer -> Executor'
		);
		expect(errors).toEqual([]);
		expect(parsed).toEqual({
			kind: 'flow',
			edges: [
				{ from: 'Parser', to: 'Optimizer', label: 'relational algebra' },
				{ from: 'Optimizer', to: 'Executor' }
			]
		});
	});

	it('trims names and labels and ignores blank lines', () => {
		const { parsed } = parse('flow', '', '  A   ->   B  :   go  ', '', 'B -> C');
		expect(parsed).toEqual({
			kind: 'flow',
			edges: [
				{ from: 'A', to: 'B', label: 'go' },
				{ from: 'B', to: 'C' }
			]
		});
	});

	it('reads "A -> B :" as an arrow with no label', () => {
		const { parsed } = parse('flow', 'A -> B :');
		expect(parsed).toEqual({ kind: 'flow', edges: [{ from: 'A', to: 'B' }] });
	});

	it('does not treat a colon inside a word as the label separator', () => {
		const { parsed } = parse('flow', 'Client -> Web : see http://example.org');
		expect(parsed).toEqual({
			kind: 'flow',
			edges: [{ from: 'Client', to: 'Web', label: 'see http://example.org' }]
		});
	});

	it('a bad line rejects the whole diagram, and its error names the line and the expected form', () => {
		const { parsed, errors } = parse('flow', 'A -> B', 'this is not an arrow', 'B -> C');
		expect(parsed).toBeNull();
		expect(errors).toHaveLength(1);
		expect(errors[0]?.line).toBe(2);
		expect(errors[0]?.message).toContain('A -> B');
	});

	it('reports every bad line', () => {
		const { parsed, errors } = parse('flow', 'A ->', 'B -> C', '-> D', 'nonsense');
		expect(parsed).toBeNull();
		expect(errors.map((e) => e.line)).toEqual([1, 3, 4]);
	});

	it('needs at least one arrow', () => {
		for (const text of ['', '  \n\n']) {
			const { parsed, errors } = parseDiagramText('flow', text);
			expect(parsed).toBeNull();
			expect(errors.length).toBeGreaterThan(0);
		}
	});

	it('does not allow a source: line', () => {
		const { parsed, errors } = parse('flow', 'A -> B', 'source: slide12.png');
		expect(parsed).toBeNull();
		expect(errors.map((e) => e.line)).toContain(2);
	});

	it('is deterministic', () => {
		const text = 'A -> B : x\nB -> C';
		expect(parseDiagramText('flow', text)).toEqual(parseDiagramText('flow', text));
	});
});

// ---------------------------------------------------------------------------------------------

const stored = (
	kind: 'stack' | 'flow',
	arrows: readonly [string, string, string?][]
): DiagramStructure => {
	const labels: string[] = [];
	for (const [f, t] of arrows) for (const l of [f, t]) if (!labels.includes(l)) labels.push(l);
	const nodes = labels.map((label, i) => ({ id: uuid(0x100 + i), label }));
	const idOf = (label: string) => nodes.find((n) => n.label === label)?.id ?? '';
	return {
		kind,
		name: 'x',
		nodes,
		edges: arrows.map(([f, t, label], i) => ({
			id: uuid(0x200 + i),
			from: idOf(f),
			to: idOf(t),
			...(label ? { label } : {})
		}))
	};
};

describe('formatDiagram', () => {
	it('writes a stack’s layers top to bottom, with roles', () => {
		const diagram: DiagramStructure = {
			kind: 'stack',
			name: 'OSI',
			nodes: [
				{ id: uuid(1), label: 'Application', role: 'HTTP' },
				{ id: uuid(2), label: 'Transport' }
			],
			edges: []
		};
		expect(formatDiagram(diagram).split('\n').filter(Boolean)).toEqual([
			'Application :: HTTP',
			'Transport'
		]);
	});

	it('writes a flow’s arrows in edge order, by node label, with the label when there is one', () => {
		const diagram = stored('flow', [
			['Parser', 'Optimizer', 'relational algebra'],
			['Optimizer', 'Executor'],
			['Executor', 'Parser', 'errors']
		]);
		expect(formatDiagram(diagram).split('\n').filter(Boolean)).toEqual([
			'Parser -> Optimizer : relational algebra',
			'Optimizer -> Executor',
			'Executor -> Parser : errors'
		]);
	});
});

describe('formatDiagram and parseDiagramText round-trip', () => {
	it('gives back the same flow', () => {
		const diagram = stored('flow', [
			['Client', 'Server', 'request'],
			['Server', 'Database'],
			['Database', 'Server', 'rows']
		]);
		const { parsed, errors } = parseDiagramText('flow', formatDiagram(diagram));
		expect(errors).toEqual([]);
		expect(parsed).toEqual({
			kind: 'flow',
			edges: diagram.edges.map((e) => ({
				from: diagram.nodes.find((n) => n.id === e.from)?.label,
				to: diagram.nodes.find((n) => n.id === e.to)?.label,
				...(e.label ? { label: e.label } : {})
			}))
		});
	});

	it('gives back the same stack, roles included', () => {
		const diagram: DiagramStructure = {
			kind: 'stack',
			name: 'OSI',
			nodes: [
				{ id: uuid(1), label: 'Application', role: 'HTTP' },
				{ id: uuid(2), label: 'Transport' },
				{ id: uuid(3), label: 'Network', role: 'IP' }
			],
			edges: []
		};
		expect(parseDiagramText('stack', formatDiagram(diagram)).parsed).toEqual({
			kind: 'stack',
			layers: [
				{ label: 'Application', role: 'HTTP' },
				{ label: 'Transport' },
				{ label: 'Network', role: 'IP' }
			]
		});
	});

	const word = fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,8}( [A-Za-z0-9]{1,6})?$/);

	it('holds for any flow of simple names (property)', () => {
		const arrow = fc.tuple(word, word, fc.option(word, { nil: undefined }));
		fc.assert(
			fc.property(fc.array(arrow, { minLength: 1, maxLength: 8 }), (arrows) => {
				const diagram = stored('flow', arrows);
				const { parsed, errors } = parseDiagramText('flow', formatDiagram(diagram));
				expect(errors).toEqual([]);
				expect(parsed).toEqual({
					kind: 'flow',
					edges: arrows.map(([from, to, label]) => ({ from, to, ...(label ? { label } : {}) }))
				});
			}),
			{ numRuns: NUM_RUNS }
		);
	});

	// Distinct by `nodeKey`: "Cache" and "cache" are one layer (Decisions "Phase 6 step 13 review").
	it('holds for any stack of distinct simple names (property)', () => {
		const distinct = { minLength: 2, maxLength: 8, selector: nodeKey };
		fc.assert(
			fc.property(fc.uniqueArray(word, distinct), (labels) => {
				const diagram: DiagramStructure = {
					kind: 'stack',
					name: 'x',
					nodes: labels.map((label, i) => ({ id: uuid(0x100 + i), label })),
					edges: []
				};
				expect(parseDiagramText('stack', formatDiagram(diagram)).parsed).toEqual({
					kind: 'stack',
					layers: labels.map((label) => ({ label }))
				});
			}),
			{ numRuns: NUM_RUNS }
		);
	});

	it('editing the formatted text without changing it keeps every ID through mergeDiagram', () => {
		const diagram = stored('flow', [
			['Client', 'Server', 'request'],
			['Server', 'Database', 'query'],
			['Database', 'Server', 'rows']
		]);
		const { parsed } = parseDiagramText('flow', formatDiagram(diagram));
		if (!parsed) throw new Error('round-trip failed');
		let issued = 0;
		const { result } = mergeDiagram(diagram, parsed, 'x', () => {
			issued += 1;
			return uuid(0x900 + issued);
		});
		expect(issued).toBe(0);
		expect(result.nodes.map((n) => n.id)).toEqual(diagram.nodes.map((n) => n.id));
		expect(result.edges.map((e) => e.id)).toEqual(diagram.edges.map((e) => e.id));
	});
});

describe('repeated layers by the merge key (Phase 6 review)', () => {
	it('rejects layers that differ only by case or spacing, in the editor text', () => {
		const { parsed, errors } = parse('stack', 'Cache', 'Disk', 'cache');
		expect(parsed).toBeNull();
		expect(errors[0]?.line).toBe(3);
		expect(errors[0]?.message).toContain('Layer "cache" is listed twice.');
	});

	it('skips an imported stack whose layers differ only by case or spacing', async () => {
		const { parseImport } = await import('#lib/import/parser.ts');
		const { errors } = parseImport('@deck A\n@diagram stack Memory\nCache\nDisk\nCa che\n');
		expect(errors.some((e) => e.message.includes('Layer "Ca che" is listed twice.'))).toBe(true);
	});
});
