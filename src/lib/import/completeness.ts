import type { Block, ImportDocument } from './ast.ts';

/** Whether a paste ended: with `@end`, stopped cleanly at `@next`, or cut off. */
export type ReplyStatus = 'complete' | 'stopped' | 'cut';

/** Where to resume an unfinished import. */
export interface ResumePoint {
	topicKey: string;
	section?: string;
}

export interface Completeness {
	status: ReplyStatus;
	/** The blocks to import: for a cut reply, without its half-written last section. */
	document: ImportDocument;
	/** Set unless complete: the `@next` point, or the dropped section. */
	resume?: ResumePoint;
	/** First line of what was dropped from a cut reply. */
	droppedFromLine?: number;
}

const V2_KINDS = new Set<Block['kind']>(['map', 'topic', 'section']);

/** The index of the last block that opens a content topic (`@topic` without section lines, `@deck`). */
function lastTopicIndex(blocks: readonly Block[]): number {
	return blocks.findLastIndex(
		(block) => block.kind === 'deck' || (block.kind === 'topic' && block.sections.length === 0)
	);
}

function topicKeyOf(block: Block | undefined, blocks: readonly Block[]): string | undefined {
	if (block?.kind === 'topic') return block.key;
	if (block?.kind === 'deck') return block.name;
	const planned = blocks.find((candidate) => candidate.kind === 'topic');
	return planned?.kind === 'topic' ? planned.key : undefined;
}

/** A cut Import v2 reply: drop the last section of the last topic and resume at it. */
function cut(blocks: readonly Block[]): Completeness {
	const topicIndex = lastTopicIndex(blocks);
	const topicKey = topicKeyOf(blocks[topicIndex], blocks);
	const hasSection = blocks.some((block, i) => i > topicIndex && block.kind === 'section');
	const opener = blocks.findLastIndex(
		(block, i) => i > topicIndex && (hasSection ? block.kind === 'section' : block.kind === 'read')
	);
	const dropped = opener >= 0 ? blocks[opener] : undefined;
	const section = dropped?.kind === 'section' ? dropped.title : undefined;
	return {
		status: 'cut',
		document: { blocks: dropped ? blocks.slice(0, opener) : [...blocks] },
		...(topicKey ? { resume: { topicKey, ...(section ? { section } : {}) } } : {}),
		...(dropped ? { droppedFromLine: dropped.line } : {})
	};
}

/**
 * Decides whether a paste is complete. The last block `@end` → complete. `@next` → stopped
 * cleanly; resume there. Neither → cut off: in an Import v2 reply, drop the last section of the
 * last topic (from its `@section`, or `@read` when it has none) and resume at it. A legacy
 * `@deck` paste without `@end` is only reported as cut: nothing is dropped.
 *
 * @see docs/PROMPTS.md §1, §7 (partial replies) and Decisions log (Import v2: completeness)
 */
export function checkCompleteness(document: ImportDocument): Completeness {
	const { blocks } = document;
	const last = blocks.at(-1);
	if (!last || last.kind === 'end') return { status: 'complete', document };
	if (last.kind === 'next') {
		const resume = { topicKey: last.topicKey, ...(last.section ? { section: last.section } : {}) };
		return { status: 'stopped', document, resume };
	}
	if (!blocks.some((block) => V2_KINDS.has(block.kind))) {
		const topicKey = topicKeyOf(blocks[lastTopicIndex(blocks)], blocks);
		return { status: 'cut', document, ...(topicKey ? { resume: { topicKey } } : {}) };
	}
	return cut(blocks);
}
