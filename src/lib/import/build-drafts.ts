import type { Block, PairEntry } from './ast.ts';
import type { PlannedContent } from './build.ts';
import type { StructureKind } from './build-structure.ts';
import { readKeyWords } from './key-words.ts';

/** A block that makes notes (not structure). */
export type NoteBlock = Exclude<Block, { kind: StructureKind }>;

/** A note's content before the sticky state is applied. */
export interface Draft {
	line: number;
	content: PlannedContent;
	isChecked: boolean;
	isAdded?: boolean;
	sourceFile?: string;
}

function pairDrafts(
	block: { entries: PairEntry[] },
	toContent: (left: string, right: string) => PlannedContent
): Draft[] {
	return block.entries.map(({ line, left, right, isChecked, isAdded }) => ({
		line,
		isChecked,
		isAdded,
		content: toContent(left, right)
	}));
}

function diagramContent(
	block: Extract<Block, { kind: 'diagramStack' | 'diagramFlow' }>,
	newId: () => string
): PlannedContent {
	if (block.kind === 'diagramStack') {
		const nodes = block.layers.map((layer) => ({ id: newId(), ...layer }));
		return { type: 'diagram', payload: { kind: 'stack', name: block.name, nodes, edges: [] } };
	}
	const ids = new Map<string, string>();
	for (const { from, to } of block.edges) {
		for (const label of [from, to]) if (!ids.has(label)) ids.set(label, newId());
	}
	const nodes = [...ids].map(([label, id]) => ({ id, label }));
	const edges = block.edges.map(({ from, to, label }) => ({
		id: newId(),
		from: ids.get(from) ?? '',
		to: ids.get(to) ?? '',
		...(label ? { label } : {})
	}));
	return { type: 'diagram', payload: { kind: 'flow', name: block.name, nodes, edges } };
}

/** A `@fact` with its `*key words*` read: shown without markers, a starred list makes one card. */
function factPayload(
	term: string,
	definition: string
): Extract<PlannedContent, { type: 'fact' }>['payload'] {
	const { text, keyWords, list } = readKeyWords(definition);
	return {
		term,
		definition: text,
		...(keyWords.length > 0 ? { keyWords } : {}),
		...(list ? { list: true as const } : {})
	};
}

/** Blocks that make one note per line. */
function draftsPerLine(block: Extract<NoteBlock, { entries: unknown }>): Draft[] {
	switch (block.kind) {
		case 'keyterms':
			return pairDrafts(block, (term, meaning) => ({
				type: 'keyterm',
				payload: { term, meaning }
			}));
		case 'fact':
			return pairDrafts(block, (term, definition) => ({
				type: 'fact',
				payload: factPayload(term, definition)
			}));
		case 'link':
		case 'scenario':
			return pairDrafts(block, (situation, answer) => ({
				type: 'scenario',
				payload: { situation, answer }
			}));
		case 'cloze':
			return block.entries.map(({ line, text, isChecked, isAdded }) => ({
				line,
				isChecked,
				isAdded,
				content: { type: 'cloze', payload: { text } }
			}));
	}
}

/** Blocks that make one note in all. */
function singleContent(
	block: Exclude<NoteBlock, { entries: unknown }>,
	newId: () => string
): PlannedContent {
	switch (block.kind) {
		case 'sequence':
			return { type: 'sequence', payload: { name: block.name, steps: block.steps } };
		case 'example':
			return { type: 'example', payload: { name: block.name, steps: block.steps } };
		case 'compare':
			return { type: 'compare', payload: { items: block.items, rows: block.rows } };
		case 'occlusion':
			return { type: 'occlusion', file: block.file };
		case 'diagramStack':
		case 'diagramFlow':
			return diagramContent(block, newId);
	}
}

/**
 * A note block's contents as drafts: one per line, or one for the whole block.
 *
 * @see BUILD_PLAN §4 and §5
 */
export function toDrafts(block: NoteBlock, newId: () => string): Draft[] {
	if ('entries' in block) return draftsPerLine(block);
	return [
		{
			line: block.line,
			isChecked: block.isChecked,
			content: singleContent(block, newId),
			...('sourceFile' in block && block.sourceFile ? { sourceFile: block.sourceFile } : {})
		}
	];
}
