import type { Chunk } from '#lib/db/schemas/course.ts';
import type { Priority } from '#lib/db/schemas/common.ts';
import { generateCards, type CardSpec, type NoteContent } from '#lib/engine/cardgen.ts';
import type { Block, ImportDocument, ImportError, PairEntry } from './ast.ts';
import { fileKey } from './zip.ts';

/** A note's content before its image exists in `media`: occlusion names the file instead. */
export type PlannedContent =
	Exclude<NoteContent, { type: 'occlusion' }> | { type: 'occlusion'; file: string };

/** A chunk about to be written. @see DATA_MODEL §3.3 */
export interface PlannedChunk extends Pick<Chunk, 'text' | 'words' | 'source' | 'check'> {
	line: number;
}

/** A note and its cards about to be written. @see DATA_MODEL §3.4 */
export interface PlannedNote {
	line: number;
	content: PlannedContent;
	/** The image a diagram was drawn from, if its block named one. */
	sourceFile?: string;
	/** Index into the topic's `chunks`. */
	chunkIndex?: number;
	priority: Priority;
	tags: string[];
	isGenerated: boolean;
	isChecked: boolean;
	cards: CardSpec[];
}

/** A topic and everything under it, in file order. @see DATA_MODEL §3.2 */
export interface PlannedTopic {
	name: string;
	priority: Priority;
	chunks: PlannedChunk[];
	notes: PlannedNote[];
}

/** Everything the valid part of an import would create. */
export interface ImportPlan {
	topics: PlannedTopic[];
	/** Sections listed by `@coverage`; shown in the preview, never stored. */
	coverage: string[];
}

/** What the builder needs from outside. */
export interface BuildContext {
	/** Attached images, as `fileKey()` values. */
	files: ReadonlySet<string>;
	newId: () => string;
}

type NoteBlock = Exclude<
	Block,
	{ kind: 'deck' | 'tag' | 'priority' | 'read' | 'coverage' | 'end' }
>;

/** A note's content before the sticky state is applied. */
interface Draft {
	line: number;
	content: PlannedContent;
	isChecked: boolean;
	sourceFile?: string;
}

/** Where the builder is in the file. `@deck` resets all of it but the topic. */
interface BuildState {
	context: BuildContext;
	topics: Map<string, PlannedTopic>;
	coverage: string[];
	errors: ImportError[];
	topic?: PlannedTopic;
	chunkIndex?: number;
	tag?: string;
	priority: Priority;
}

const NOT_A_NOTE_BLOCK = new Set<Block['kind']>(['tag', 'priority', 'keyterms']);

function directiveLabel(block: Block): string {
	if (block.kind === 'diagramStack') return '@diagram stack';
	if (block.kind === 'diagramFlow') return '@diagram flow';
	return `@${block.kind}`;
}

/** The current topic; without one the block is reported and skipped. */
function requireTopic(state: BuildState, block: Block): PlannedTopic | undefined {
	if (!state.topic) {
		state.errors.push({
			line: block.line,
			message: `${directiveLabel(block)} comes before any @deck, so it was skipped.`
		});
	}
	return state.topic;
}

function openDeck(state: BuildState, name: string): void {
	const topic = state.topics.get(name) ?? { name, priority: 'normal', chunks: [], notes: [] };
	state.topics.set(name, topic);
	state.topic = topic;
	state.chunkIndex = undefined;
	state.tag = undefined;
	state.priority = 'normal';
}

function applyPriority(state: BuildState, block: Extract<Block, { kind: 'priority' }>): void {
	const topic = requireTopic(state, block);
	if (!topic) return;
	state.priority = block.value;
	if (block.value === 'high') topic.priority = 'high';
}

function addChunk(state: BuildState, block: Extract<Block, { kind: 'read' }>): void {
	const topic = requireTopic(state, block);
	if (!topic) return;
	topic.chunks.push({
		line: block.line,
		text: block.text,
		words: block.text.split(/\s+/).filter(Boolean).length,
		source: block.isGenerated ? 'generated' : 'notes',
		...(block.isChecked ? { check: true as const } : {})
	});
	state.chunkIndex = topic.chunks.length - 1;
}

function pairDrafts(
	block: { entries: PairEntry[] },
	toContent: (left: string, right: string) => PlannedContent
): Draft[] {
	return block.entries.map(({ line, left, right, isChecked }) => ({
		line,
		isChecked,
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
				payload: { term, definition }
			}));
		case 'scenario':
			return pairDrafts(block, (situation, answer) => ({
				type: 'scenario',
				payload: { situation, answer }
			}));
		case 'cloze':
			return block.entries.map(({ line, text, isChecked }) => ({
				line,
				isChecked,
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

/** The image a block needs: reported and skipped when it isn't attached. */
function hasRequiredImage(state: BuildState, block: NoteBlock): boolean {
	const file =
		block.kind === 'occlusion'
			? block.file
			: block.kind === 'diagramStack' || block.kind === 'diagramFlow'
				? block.sourceFile
				: undefined;
	if (file === undefined || state.context.files.has(fileKey(file))) return true;
	state.errors.push({ line: block.line, message: `Image "${file}" is not attached.` });
	return false;
}

function toDrafts(block: NoteBlock, newId: () => string): Draft[] {
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

/**
 * `@keyterms` is written before the `@read` it prepares for (BUILD_PLAN §4.3), so it belongs to
 * the `@read` that comes next, if only `@tag`, `@priority` or more keyterms come between.
 */
function upcomingRead(blocks: Block[], from: number): Extract<Block, { kind: 'read' }> | undefined {
	const next = blocks.slice(from + 1).find((block) => !NOT_A_NOTE_BLOCK.has(block.kind));
	return next?.kind === 'read' ? next : undefined;
}

function chunkFor(
	state: BuildState,
	topic: PlannedTopic,
	block: NoteBlock,
	upcoming: Extract<Block, { kind: 'read' }> | undefined
): { chunkIndex?: number; isGenerated: boolean } {
	if (block.kind === 'keyterms' && upcoming) {
		return { chunkIndex: topic.chunks.length, isGenerated: upcoming.isGenerated };
	}
	if (state.chunkIndex === undefined) return { isGenerated: false };
	const chunk = topic.chunks[state.chunkIndex];
	return { chunkIndex: state.chunkIndex, isGenerated: chunk?.source === 'generated' };
}

function addNotes(state: BuildState, block: NoteBlock, blocks: Block[], index: number): void {
	const topic = requireTopic(state, block);
	if (!topic || !hasRequiredImage(state, block)) return;
	const chunk = chunkFor(state, topic, block, upcomingRead(blocks, index));
	for (const draft of toDrafts(block, state.context.newId)) {
		topic.notes.push({
			...draft,
			...chunk,
			priority: state.priority,
			tags: state.tag ? [state.tag] : [],
			cards: draft.content.type === 'occlusion' ? [] : generateCards(draft.content).result
		});
	}
}

function applyBlock(state: BuildState, block: Block, blocks: Block[], index: number): void {
	switch (block.kind) {
		case 'deck':
			return openDeck(state, block.name);
		case 'tag':
			if (requireTopic(state, block)) state.tag = block.name;
			return;
		case 'priority':
			return applyPriority(state, block);
		case 'read':
			return addChunk(state, block);
		case 'coverage':
			state.coverage.push(...block.sections);
			return;
		case 'end':
			return;
		default:
			return addNotes(state, block, blocks, index);
	}
}

/**
 * Turns parsed blocks into topics, chunks, notes and cards, without touching storage.
 *
 * @see BUILD_PLAN §4 and §5
 */
export function buildPlan(
	document: ImportDocument,
	context: BuildContext
): { plan: ImportPlan; errors: ImportError[] } {
	const state: BuildState = {
		context,
		topics: new Map(),
		coverage: [],
		errors: [],
		priority: 'normal'
	};
	document.blocks.forEach((block, index) => applyBlock(state, block, document.blocks, index));
	return {
		plan: { topics: [...state.topics.values()], coverage: state.coverage },
		errors: state.errors
	};
}
