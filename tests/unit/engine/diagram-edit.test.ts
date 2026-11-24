import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
	mergeDiagram,
	renameNode,
	type DiagramStructure,
	type ParsedDiagram
} from '#lib/engine/diagram-edit.ts';
import { normalizeAnswer } from '#lib/engine/grading.ts';
import { mediaId, NUM_RUNS, uuid } from './fixtures.ts';

/** Fresh IDs from a counter, remembering how many were handed out. */
function idSource(start = 0x9000) {
	let next = start;
	const issued: string[] = [];
	return {
		newId: () => {
			const id = uuid(next);
			next += 1;
			issued.push(id);
			return id;
		},
		issued
	};
}

type Arrow = readonly [string, string, string?];

/** A stored flow with deterministic IDs: nodes in first-mention order, arrows in list order. */
function storedFlow(arrows: readonly Arrow[]): DiagramStructure {
	const labels: string[] = [];
	for (const [from, to] of arrows) {
		for (const label of [from, to]) if (!labels.includes(label)) labels.push(label);
	}
	const nodes = labels.map((label, i) => ({ id: uuid(0x100 + i), label }));
	const idOf = (label: string): string => {
		const found = nodes.find((n) => n.label === label);
		if (!found) throw new Error(`fixture: no node ${label}`);
		return found.id;
	};
	return {
		kind: 'flow',
		name: 'Old name',
		nodes,
		edges: arrows.map(([from, to, label], i) => ({
			id: uuid(0x200 + i),
			from: idOf(from),
			to: idOf(to),
			...(label ? { label } : {})
		})),
		layout: { [uuid(0x100)]: { x: 5, y: 6 } },
		sourceMediaId: mediaId(3)
	};
}

function storedStack(labels: readonly string[]): DiagramStructure {
	return {
		kind: 'stack',
		name: 'Old stack',
		nodes: labels.map((label, i) => ({ id: uuid(0x100 + i), label })),
		edges: []
	};
}

const parsedFlow = (arrows: readonly Arrow[]): ParsedDiagram => ({
	kind: 'flow',
	edges: arrows.map(([from, to, label]) => ({ from, to, ...(label ? { label } : {}) }))
});
const parsedStack = (layers: readonly string[]): ParsedDiagram => ({
	kind: 'stack',
	layers: layers.map((label) => ({ label }))
});

const idOfLabel = (d: DiagramStructure, label: string): string | undefined =>
	d.nodes.find((n) => normalizeAnswer(n.label) === normalizeAnswer(label))?.id;
const edgeBetween = (d: DiagramStructure, from: string, to: string, nth = 0) => {
	const f = idOfLabel(d, from);
	const t = idOfLabel(d, to);
	return d.edges.filter((e) => e.from === f && e.to === t)[nth];
};

const ARROWS: readonly Arrow[] = [
	['Client', 'Server', 'request'],
	['Server', 'Database', 'query'],
	['Database', 'Server', 'rows'],
	['Server', 'Client', 'response']
];

// ---------------------------------------------------------------------------------------------

describe('mergeDiagram with no previous diagram (BUILD_PLAN §7.2)', () => {
	it('gives every node and arrow a new ID from newId, and the given name', () => {
		const { newId, issued } = idSource();
		const { result } = mergeDiagram(null, parsedFlow(ARROWS), 'Web app', newId);
		expect(result.kind).toBe('flow');
		expect(result.name).toBe('Web app');
		expect(result.nodes).toHaveLength(3);
		expect(result.edges).toHaveLength(4);
		const ids = [...result.nodes.map((n) => n.id), ...result.edges.map((e) => e.id)];
		expect(new Set(ids).size).toBe(ids.length);
		expect([...ids].sort()).toEqual([...issued].sort());
	});

	it('lists a flow’s nodes in first-mention order and its arrows in line order, labels kept', () => {
		const { result } = mergeDiagram(null, parsedFlow(ARROWS), 'x', idSource().newId);
		expect(result.nodes.map((n) => n.label)).toEqual(['Client', 'Server', 'Database']);
		expect(
			result.edges.map((e) => [
				result.nodes.find((n) => n.id === e.from)?.label,
				result.nodes.find((n) => n.id === e.to)?.label,
				e.label
			])
		).toEqual(ARROWS.map(([f, t, l]) => [f, t, l]));
	});

	it('treats labels that differ only in case or spacing as one node', () => {
		const { result } = mergeDiagram(
			null,
			parsedFlow([
				['Query Parser', 'Optimizer'],
				['query   parser', 'Executor']
			]),
			'x',
			idSource().newId
		);
		expect(result.nodes).toHaveLength(3);
		expect(result.edges[0]?.from).toBe(result.edges[1]?.from);
	});

	it('builds a stack from its layers top to bottom, with roles and no arrows', () => {
		const parsed: ParsedDiagram = {
			kind: 'stack',
			layers: [{ label: 'Application', role: 'HTTP' }, { label: 'Transport' }, { label: 'Network' }]
		};
		const { result } = mergeDiagram(null, parsed, 'OSI', idSource().newId);
		expect(result.kind).toBe('stack');
		expect(result.name).toBe('OSI');
		expect(result.nodes.map((n) => n.label)).toEqual(['Application', 'Transport', 'Network']);
		expect(result.nodes[0]?.role).toBe('HTTP');
		expect(result.edges).toEqual([]);
	});

	it('returns a trace', () => {
		expect(
			Array.isArray(mergeDiagram(null, parsedStack(['A', 'B']), 'x', idSource().newId).trace)
		).toBe(true);
	});
});

describe('mergeDiagram keeps node IDs by normalised label', () => {
	const previous = storedFlow(ARROWS);

	it('changes no ID and asks for none when the text is unchanged', () => {
		const { newId, issued } = idSource();
		const { result } = mergeDiagram(previous, parsedFlow(ARROWS), 'ignored', newId);
		expect(issued).toEqual([]);
		expect(result.nodes.map((n) => n.id)).toEqual(previous.nodes.map((n) => n.id));
		expect(result.edges.map((e) => e.id)).toEqual(previous.edges.map((e) => e.id));
	});

	it('keeps an ID when the label differs only in case or spacing', () => {
		const { result } = mergeDiagram(
			previous,
			parsedFlow([['  client ', 'SERVER', 'request']]),
			'x',
			idSource().newId
		);
		expect(idOfLabel(result, 'client')).toBe(idOfLabel(previous, 'Client'));
		expect(idOfLabel(result, 'server')).toBe(idOfLabel(previous, 'Server'));
	});

	it('gives a new label a new ID and drops a node the text no longer mentions', () => {
		const { newId, issued } = idSource();
		const { result } = mergeDiagram(
			previous,
			parsedFlow([
				['Client', 'Server', 'request'],
				['Server', 'Cache', 'lookup']
			]),
			'x',
			newId
		);
		expect(idOfLabel(result, 'Client')).toBe(idOfLabel(previous, 'Client'));
		expect(idOfLabel(result, 'Server')).toBe(idOfLabel(previous, 'Server'));
		expect(issued).toContain(idOfLabel(result, 'Cache'));
		expect(idOfLabel(result, 'Database')).toBeUndefined();
		expect(result.nodes).toHaveLength(3);
	});

	it('does not keep an ID for a renamed node: renaming in the text is a delete plus an add', () => {
		const { result } = mergeDiagram(
			previous,
			parsedFlow([
				['Client', 'Server', 'request'],
				['Server', 'Postgres', 'query']
			]),
			'x',
			idSource().newId
		);
		expect(idOfLabel(result, 'Postgres')).not.toBe(idOfLabel(previous, 'Database'));
		expect(result.nodes.map((n) => n.id)).not.toContain(idOfLabel(previous, 'Database'));
	});

	it('keeps the previous name, layout and source picture, whatever name is passed', () => {
		const { result } = mergeDiagram(previous, parsedFlow(ARROWS), 'Another name', idSource().newId);
		expect(result.name).toBe('Old name');
		expect(result.layout).toEqual(previous.layout);
		expect(result.sourceMediaId).toBe(previous.sourceMediaId);
	});
});

describe('mergeDiagram keeps arrow IDs by (from, to)', () => {
	const previous = storedFlow(ARROWS);

	it('keeps an arrow’s ID when only its label changes', () => {
		const { result } = mergeDiagram(
			previous,
			parsedFlow([
				['Client', 'Server', 'HTTP request'],
				['Server', 'Database', 'query'],
				['Database', 'Server', 'rows'],
				['Server', 'Client', 'response']
			]),
			'x',
			idSource().newId
		);
		const edge = edgeBetween(result, 'Client', 'Server');
		expect(edge?.id).toBe(edgeBetween(previous, 'Client', 'Server')?.id);
		expect(edge?.label).toBe('HTTP request');
	});

	it('keeps an arrow’s ID when its label is added or removed', () => {
		const { result } = mergeDiagram(
			previous,
			parsedFlow([
				['Client', 'Server'],
				['Server', 'Database', 'query'],
				['Database', 'Server', 'rows'],
				['Server', 'Client', 'response']
			]),
			'x',
			idSource().newId
		);
		expect(edgeBetween(result, 'Client', 'Server')?.id).toBe(
			edgeBetween(previous, 'Client', 'Server')?.id
		);
		expect(edgeBetween(result, 'Client', 'Server')?.label).toBeUndefined();
	});

	it('treats a reversed arrow as a different arrow: the old ID is not reused', () => {
		const { result } = mergeDiagram(
			previous,
			parsedFlow([
				['Server', 'Client', 'request'],
				['Server', 'Database', 'query'],
				['Database', 'Server', 'rows']
			]),
			'x',
			idSource().newId
		);
		// Both directions existed before; "Server -> Client" keeps its own ID, "Client -> Server" is gone.
		expect(edgeBetween(result, 'Server', 'Client')?.id).toBe(
			edgeBetween(previous, 'Server', 'Client')?.id
		);
		expect(result.edges.map((e) => e.id)).not.toContain(
			edgeBetween(previous, 'Client', 'Server')?.id
		);
	});

	it('removing an arrow removes only its own ID; nodes and other arrows keep theirs', () => {
		const { result } = mergeDiagram(
			previous,
			parsedFlow([
				['Client', 'Server', 'request'],
				['Server', 'Database', 'query'],
				['Database', 'Server', 'rows']
			]),
			'x',
			idSource().newId
		);
		const dropped = edgeBetween(previous, 'Server', 'Client');
		expect(dropped).toBeDefined();
		expect(result.edges.map((e) => e.id)).toEqual(
			previous.edges.filter((e) => e.id !== dropped?.id).map((e) => e.id)
		);
		expect(result.nodes.map((n) => n.id)).toEqual(previous.nodes.map((n) => n.id));
	});

	it('gives a new arrow between kept nodes a new ID and leaves the others alone', () => {
		const { newId, issued } = idSource();
		const { result } = mergeDiagram(
			previous,
			parsedFlow([...ARROWS, ['Client', 'Database', 'direct']]),
			'x',
			newId
		);
		expect(issued).toHaveLength(1);
		expect(edgeBetween(result, 'Client', 'Database')?.id).toBe(issued[0]);
		expect(result.edges.slice(0, 4).map((e) => e.id)).toEqual(previous.edges.map((e) => e.id));
	});

	it('gives a new ID to an arrow whose endpoint is a new node', () => {
		const { result } = mergeDiagram(
			previous,
			parsedFlow([['Client', 'Gateway', 'request']]),
			'x',
			idSource().newId
		);
		expect(result.edges[0]?.id).not.toBe(edgeBetween(previous, 'Client', 'Server')?.id);
		expect(idOfLabel(result, 'Client')).toBe(idOfLabel(previous, 'Client'));
	});

	it('matches several arrows between the same two nodes in their previous order', () => {
		const twin = storedFlow([
			['A', 'B', 'x'],
			['A', 'B', 'y']
		]);
		const [first, second] = twin.edges;
		const same = mergeDiagram(
			twin,
			parsedFlow([
				['A', 'B', 'p'],
				['A', 'B', 'q']
			]),
			'x',
			idSource().newId
		).result;
		expect(same.edges.map((e) => e.id)).toEqual([first?.id, second?.id]);
		expect(same.edges.map((e) => e.label)).toEqual(['p', 'q']);

		const fewer = mergeDiagram(
			twin,
			parsedFlow([['A', 'B', 'only']]),
			'x',
			idSource().newId
		).result;
		expect(fewer.edges.map((e) => e.id)).toEqual([first?.id]);

		const { newId, issued } = idSource();
		const more = mergeDiagram(
			twin,
			parsedFlow([
				['A', 'B'],
				['A', 'B'],
				['A', 'B']
			]),
			'x',
			newId
		).result;
		expect(more.edges.map((e) => e.id)).toEqual([first?.id, second?.id, issued[0]]);
	});
});

describe('mergeDiagram: line order never changes an ID', () => {
	const previous = storedFlow(ARROWS);

	it('keeps every node and arrow ID when the lines are reversed', () => {
		const { newId, issued } = idSource();
		const { result } = mergeDiagram(previous, parsedFlow([...ARROWS].reverse()), 'x', newId);
		expect(issued).toEqual([]);
		for (const node of previous.nodes) expect(idOfLabel(result, node.label)).toBe(node.id);
		for (const edge of previous.edges) {
			expect(result.edges.map((e) => e.id)).toContain(edge.id);
		}
		expect(new Set(result.edges.map((e) => e.id))).toEqual(
			new Set(previous.edges.map((e) => e.id))
		);
	});

	it('maps the same label to the same ID for every ordering of the lines (property)', () => {
		fc.assert(
			fc.property(fc.shuffledSubarray([...ARROWS], { minLength: ARROWS.length }), (shuffled) => {
				const { newId, issued } = idSource();
				const { result } = mergeDiagram(previous, parsedFlow(shuffled), 'x', newId);
				expect(issued).toEqual([]);
				for (const node of previous.nodes) expect(idOfLabel(result, node.label)).toBe(node.id);
				for (const edge of previous.edges) {
					const from = previous.nodes.find((n) => n.id === edge.from)?.label ?? '';
					const to = previous.nodes.find((n) => n.id === edge.to)?.label ?? '';
					expect(edgeBetween(result, from, to)?.id).toBe(edge.id);
				}
			}),
			{ numRuns: NUM_RUNS }
		);
	});

	it('takes only a stack’s layer order from the text; IDs follow the labels', () => {
		const stack = storedStack(['Application', 'Transport', 'Network']);
		const { newId, issued } = idSource();
		const { result } = mergeDiagram(
			stack,
			parsedStack(['Network', 'Application', 'Transport']),
			'x',
			newId
		);
		expect(issued).toEqual([]);
		expect(result.nodes.map((n) => n.label)).toEqual(['Network', 'Application', 'Transport']);
		expect(result.nodes.map((n) => n.id)).toEqual([uuid(0x102), uuid(0x100), uuid(0x101)]);
		expect(result.edges).toEqual([]);
		expect(result.kind).toBe('stack');
	});

	it('removes only the dropped layer and gives an inserted layer a new ID', () => {
		const stack = storedStack(['Application', 'Transport', 'Network']);
		const { newId, issued } = idSource();
		const { result } = mergeDiagram(
			stack,
			parsedStack(['Application', 'Session', 'Network']),
			'x',
			newId
		);
		expect(result.nodes.map((n) => n.id)).toEqual([uuid(0x100), issued[0], uuid(0x102)]);
	});
});

// ---------------------------------------------------------------------------------------------

describe('renameNode (BUILD_PLAN §7.2, Decisions "Phase 6 Q5")', () => {
	const diagram = storedFlow(ARROWS);
	const server = idOfLabel(diagram, 'Server') as string;

	it('changes the label and keeps the node’s ID, every other node and every arrow', () => {
		const out = renameNode(diagram, server, 'Web server');
		expect(out.ok).toBe(true);
		if (!out.ok) return;
		expect(out.value.nodes.map((n) => n.id)).toEqual(diagram.nodes.map((n) => n.id));
		expect(out.value.nodes.find((n) => n.id === server)?.label).toBe('Web server');
		expect(out.value.nodes.filter((n) => n.id !== server)).toEqual(
			diagram.nodes.filter((n) => n.id !== server)
		);
		expect(out.value.edges).toEqual(diagram.edges);
		expect(out.value.name).toBe(diagram.name);
		expect(out.value.layout).toEqual(diagram.layout);
		expect(out.value.sourceMediaId).toBe(diagram.sourceMediaId);
	});

	it('does not change its input', () => {
		const before = structuredClone(diagram);
		renameNode(diagram, server, 'Web server');
		expect(diagram).toEqual(before);
	});

	it('trims the new label', () => {
		// SPEC-GAP: the spec says an empty label "after trimming" is an error but not whether a
		// non-empty label is stored trimmed. Reading: it is.
		const out = renameNode(diagram, server, '  Web server  ');
		expect(out.ok && out.value.nodes.find((n) => n.id === server)?.label).toBe('Web server');
	});

	it('allows changing only the case of its own label (it is not "another node")', () => {
		const out = renameNode(diagram, server, 'SERVER');
		expect(out.ok).toBe(true);
	});

	it('errors for a node that does not exist', () => {
		const out = renameNode(diagram, uuid(0xdead), 'X');
		expect(out.ok).toBe(false);
		if (!out.ok) expect(typeof out.error).toBe('string');
	});

	it.each(['', '   ', '\t\n'])('errors for an empty label (%j)', (label) => {
		expect(renameNode(diagram, server, label).ok).toBe(false);
	});

	it('errors when another node already has the label after normalising', () => {
		expect(renameNode(diagram, server, 'database').ok).toBe(false);
		expect(renameNode(diagram, server, '  DATA   base ').ok).toBe(false);
		expect(renameNode(diagram, server, 'Client').ok).toBe(false);
	});

	it('a rename followed by an edit of the text with the new label keeps every ID', () => {
		const out = renameNode(diagram, server, 'Web server');
		if (!out.ok) throw new Error('rename failed');
		const { newId, issued } = idSource();
		const { result } = mergeDiagram(
			out.value,
			parsedFlow(
				ARROWS.map(([f, t, l]) => [
					f === 'Server' ? 'Web server' : f,
					t === 'Server' ? 'Web server' : t,
					l
				])
			),
			'x',
			newId
		);
		expect(issued).toEqual([]);
		expect(result.nodes.map((n) => n.id)).toEqual(out.value.nodes.map((n) => n.id));
		expect(result.edges.map((e) => e.id)).toEqual(diagram.edges.map((e) => e.id));
	});

	it('works on a stack layer too', () => {
		const stack = storedStack(['Application', 'Transport']);
		const out = renameNode(stack, uuid(0x101), 'Transport layer');
		expect(out.ok && out.value.nodes.map((n) => [n.id, n.label])).toEqual([
			[uuid(0x100), 'Application'],
			[uuid(0x101), 'Transport layer']
		]);
	});
});

describe('mergeDiagram drops saved positions of removed nodes (Phase 6 review)', () => {
	it('keeps the layout only for nodes still present', () => {
		const previous: DiagramStructure = {
			...storedFlow([['A', 'B']]),
			layout: { [uuid(0x100)]: { x: 1, y: 2 }, [uuid(0x101)]: { x: 3, y: 4 } }
		};
		const parsed: ParsedDiagram = { kind: 'flow', edges: [{ from: 'A', to: 'C' }] };
		const { result } = mergeDiagram(previous, parsed, 'x', idSource().newId);
		expect(result.layout).toEqual({ [uuid(0x100)]: { x: 1, y: 2 } });
	});

	it('leaves out the layout when no saved node remains', () => {
		const previous = storedFlow([['A', 'B']]);
		const parsed: ParsedDiagram = { kind: 'flow', edges: [{ from: 'C', to: 'D' }] };
		const { result } = mergeDiagram(previous, parsed, 'x', idSource().newId);
		expect(result.layout).toBeUndefined();
	});
});
