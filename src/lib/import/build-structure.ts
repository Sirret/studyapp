import type { Priority } from '#lib/db/schemas/common.ts';
import type { Block, ImportError } from './ast.ts';
import type { BuildContext, PlannedTopic } from './build.ts';

/**
 * The builder's structure handling: topics (by key or `@deck` name), sections, priorities, tips,
 * summaries, early `@end` and `@next`. Notes are drafted in `build.ts`.
 *
 * @see docs/PROMPTS.md §3, §7 and Decisions log (Import v2: sections, topics by key)
 */

/** The title of the section that holds the chatbot's additions (PROMPTS §3). */
export const ADDED_SECTION = /^added by the chatbot/i;

/** Blocks that shape the course, topic or section rather than make notes. */
export type StructureKind =
	| 'deck'
	| 'tag'
	| 'priority'
	| 'read'
	| 'coverage'
	| 'end'
	| 'map'
	| 'bigpicture'
	| 'habit'
	| 'topic'
	| 'links'
	| 'cheat'
	| 'missing'
	| 'summary'
	| 'section'
	| 'tip'
	| 'next';

export type StructureBlock = Extract<Block, { kind: StructureKind }>;

/** Where the builder is in the file. Opening a topic resets all of it but the topic. */
export interface BuildState {
	context: BuildContext;
	/** By `@topic` key, or `@deck` name. */
	topics: Map<string, PlannedTopic>;
	coverage: string[];
	errors: ImportError[];
	/** Image files named by skipped blocks, in order, each once. */
	missingImages: string[];
	topic?: PlannedTopic;
	chunkIndex?: number;
	/** The current section came from `@section` and has no `@read` yet. */
	sectionOpen: boolean;
	tag?: string;
	priority: Priority;
}

export function directiveLabel(block: Block): string {
	if (block.kind === 'diagramStack') return '@diagram stack';
	if (block.kind === 'diagramFlow') return '@diagram flow';
	return `@${block.kind}`;
}

/** The current topic; without one the block is reported and skipped. */
export function requireTopic(state: BuildState, block: Block): PlannedTopic | undefined {
	if (!state.topic) {
		state.errors.push({
			line: block.line,
			message: `${directiveLabel(block)} comes before any @topic or @deck, so it was skipped.`
		});
	}
	return state.topic;
}

function resetSection(state: BuildState): void {
	state.chunkIndex = undefined;
	state.sectionOpen = false;
	state.tag = undefined;
	state.priority = 'normal';
}

/** Opens (or reopens) a topic: `@topic` by key, `@deck` by name. */
function openTopic(
	state: BuildState,
	id: string,
	fields: Partial<PlannedTopic> & { name: string }
): void {
	const topic = state.topics.get(id) ?? {
		priority: 'normal',
		from: [],
		chunks: [],
		notes: [],
		...fields
	};
	if (fields.from && fields.from.length > 0) topic.from = fields.from;
	state.topics.set(id, topic);
	state.topic = topic;
	resetSection(state);
}

function applyPriority(state: BuildState, block: Extract<Block, { kind: 'priority' }>): void {
	const topic = requireTopic(state, block);
	if (!topic) return;
	state.priority = block.value;
	if (block.value === 'high') topic.priority = 'high';
	const chunk = state.chunkIndex === undefined ? undefined : topic.chunks[state.chunkIndex];
	if (chunk?.title !== undefined && state.sectionOpen) chunk.priority = block.value;
}

function wordsOf(text: string): number {
	return text.split(/\s+/).filter(Boolean).length;
}

/** `@read`: fills the open `@section`, else opens a legacy section titled by the current `@tag`. */
function addRead(state: BuildState, block: Extract<Block, { kind: 'read' }>): void {
	const topic = requireTopic(state, block);
	if (!topic) return;
	const reading = {
		text: block.text,
		words: wordsOf(block.text),
		source: block.isGenerated ? ('generated' as const) : ('notes' as const),
		...(block.isChecked ? { check: true as const } : {})
	};
	const open =
		state.sectionOpen && state.chunkIndex !== undefined
			? topic.chunks[state.chunkIndex]
			: undefined;
	if (open) {
		Object.assign(open, reading);
		state.sectionOpen = false;
		return;
	}
	topic.chunks.push({ line: block.line, ...reading, ...(state.tag ? { title: state.tag } : {}) });
	state.chunkIndex = topic.chunks.length - 1;
}

function openSection(state: BuildState, block: Extract<Block, { kind: 'section' }>): void {
	const topic = requireTopic(state, block);
	if (!topic) return;
	topic.chunks.push({
		line: block.line,
		text: '',
		words: 0,
		source: 'notes',
		title: block.title,
		...(ADDED_SECTION.test(block.title) ? { added: true as const } : {})
	});
	state.chunkIndex = topic.chunks.length - 1;
	state.sectionOpen = true;
	state.tag = undefined;
	state.priority = 'normal';
}

function addTip(state: BuildState, block: Extract<Block, { kind: 'tip' }>): void {
	const topic = requireTopic(state, block);
	const chunk =
		topic && state.chunkIndex !== undefined ? topic.chunks[state.chunkIndex] : undefined;
	if (!topic) return;
	if (!chunk) {
		state.errors.push({
			line: block.line,
			message: '@tip comes before any section, so it was skipped.'
		});
		return;
	}
	chunk.tip = chunk.tip ? `${chunk.tip}\n${block.text}` : block.text;
}

/** `@next`: a later `@section` continues that topic (several replies pasted one after another). */
function applyNext(state: BuildState, block: Extract<Block, { kind: 'next' }>): void {
	const topic = state.topics.get(block.topicKey);
	if (topic && topic !== state.topic) {
		state.topic = topic;
		resetSection(state);
	}
}

/** Applies a structure block. Map-only blocks are collected by `collectMap` instead. */
export function applyStructure(state: BuildState, block: StructureBlock): void {
	switch (block.kind) {
		case 'deck':
			return openTopic(state, block.name, { name: block.name });
		case 'topic':
			if (block.sections.length > 0) return; // a map entry
			return openTopic(state, block.key, { name: block.title, key: block.key, from: block.from });
		case 'tag':
			if (requireTopic(state, block)) state.tag = block.name;
			return;
		case 'priority':
			return applyPriority(state, block);
		case 'read':
			return addRead(state, block);
		case 'section':
			return openSection(state, block);
		case 'tip':
			return addTip(state, block);
		case 'summary': {
			const topic = requireTopic(state, block);
			if (topic) topic.summary = topic.summary ? `${topic.summary}\n${block.text}` : block.text;
			return;
		}
		case 'coverage':
			state.coverage.push(...block.sections);
			return;
		case 'end':
			state.topic = undefined;
			return resetSection(state);
		case 'next':
			return applyNext(state, block);
		case 'map':
		case 'bigpicture':
		case 'habit':
		case 'links':
		case 'cheat':
		case 'missing':
			return;
	}
}
