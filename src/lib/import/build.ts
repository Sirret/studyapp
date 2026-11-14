import type { Chunk } from '#lib/db/schemas/course.ts';
import type { Priority } from '#lib/db/schemas/common.ts';
import { generateCards, type CardSpec, type NoteContent } from '#lib/engine/cardgen.ts';
import type { Block, ImportDocument, ImportError, PairEntry } from './ast.ts';
import { collectMap, type PlannedMap } from './build-map.ts';
import {
	applyStructure,
	requireTopic,
	type BuildState,
	type StructureBlock,
	type StructureKind
} from './build-structure.ts';
import {
	checkCompleteness,
	type Completeness,
	type ReplyStatus,
	type ResumePoint
} from './completeness.ts';
import { readKeyWords } from './key-words.ts';
import { fileKey } from './zip.ts';

/** A note's content before its image exists in `media`: occlusion names the file instead. */
export type PlannedContent =
	Exclude<NoteContent, { type: 'occlusion' }> | { type: 'occlusion'; file: string };

/** A section (chunk) about to be written. @see DATA_MODEL §3.3 */
export interface PlannedChunk extends Pick<
	Chunk,
	'text' | 'words' | 'source' | 'check' | 'title' | 'priority' | 'tip' | 'added'
> {
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
	/** The map id (`@topic <key>`); absent for `@deck` topics. */
	key?: string;
	/** Normalised lecture names (`from:`). */
	from: string[];
	summary?: string;
	/** Its reply was cut off inside it. */
	partial?: true;
	chunks: PlannedChunk[];
	notes: PlannedNote[];
}

/** Everything the valid part of an import would create. */
export interface ImportPlan {
	topics: PlannedTopic[];
	/** Sections listed by `@coverage`; shown in the preview, never stored. */
	coverage: string[];
	/** The course map, when the paste has `@map`. */
	map: PlannedMap | null;
	status: ReplyStatus;
	/** Where to resume, unless complete. */
	resume?: ResumePoint;
}

/** What the builder needs from outside. */
export interface BuildContext {
	/** Attached images, as `fileKey()` values. */
	files: ReadonlySet<string>;
	newId: () => string;
}

type NoteBlock = Exclude<Block, { kind: StructureKind }>;

/** A note's content before the sticky state is applied. */
interface Draft {
	line: number;
	content: PlannedContent;
	isChecked: boolean;
	isAdded?: boolean;
	sourceFile?: string;
}

const NOT_A_NOTE_BLOCK = new Set<Block['kind']>(['tag', 'priority', 'keyterms']);

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
	const tags = block.kind === 'link' ? [`link:${block.topicKey}`] : state.tag ? [state.tag] : [];
	for (const { isAdded, ...draft } of toDrafts(block, state.context.newId)) {
		topic.notes.push({
			...draft,
			...chunk,
			...(isAdded ? { isGenerated: true } : {}),
			priority: state.priority,
			tags,
			cards: draft.content.type === 'occlusion' ? [] : generateCards(draft.content).result
		});
	}
}

const STRUCTURE_KINDS = new Set<Block['kind']>([
	'deck',
	'tag',
	'priority',
	'read',
	'coverage',
	'end',
	'map',
	'bigpicture',
	'habit',
	'topic',
	'links',
	'cheat',
	'missing',
	'summary',
	'section',
	'tip',
	'next'
] satisfies StructureKind[]);

function isStructure(block: Block): block is StructureBlock {
	return STRUCTURE_KINDS.has(block.kind);
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

/** Marks the topic the reply stopped or was cut in as partial. */
function markPartial(state: BuildState, done: Completeness, map: PlannedMap | null): void {
	const topic = done.resume ? state.topics.get(done.resume.topicKey) : undefined;
	if (!topic || done.status === 'complete') return;
	const planned = map?.topics.find((entry) => entry.key === done.resume?.topicKey);
	const fewer = planned !== undefined && topic.chunks.length < planned.sections.length;
	if (done.status === 'cut' || done.resume?.section !== undefined || fewer) topic.partial = true;
}

function applyBlock(state: BuildState, block: Block, blocks: Block[], index: number): void {
	if (isStructure(block)) applyStructure(state, block);
	else addNotes(state, block, blocks, index);
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
		sectionOpen: false,
		priority: 'normal'
	};
	const done = checkCompleteness(document);
	const { map, errors: mapErrors } = collectMap(document);
	const { blocks } = done.document;
	blocks.forEach((block, index) => applyBlock(state, block, blocks, index));
	markPartial(state, done, map);
	return {
		plan: {
			topics: [...state.topics.values()],
			coverage: state.coverage,
			map,
			status: done.status,
			...(done.resume ? { resume: done.resume } : {})
		},
		errors: [...state.errors, ...mapErrors].sort((a, b) => a.line - b.line)
	};
}
