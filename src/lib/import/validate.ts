import type { ImportPlan } from './build.ts';

/** A card whose starred key words its section's reading never says. */
export interface StarredGap {
	line: number;
	topic: string;
	/** The starred phrases not found in the reading. */
	missing: string[];
}

/**
 * Finds `@fact` notes whose `*key words*` don't appear (ignoring case) in their section's `@read`.
 * Sections without a reading are not checked.
 *
 * @see docs/PROMPTS.md §3 (CARD RULES) and Decisions log (Import v2: starred-word check)
 */
export function starredGaps(plan: ImportPlan): StarredGap[] {
	return plan.topics.flatMap((topic) =>
		topic.notes.flatMap((note) => {
			if (note.content.type !== 'fact' || note.chunkIndex === undefined) return [];
			const reading = topic.chunks[note.chunkIndex]?.text.toLowerCase() ?? '';
			if (reading === '') return [];
			const missing = (note.content.payload.keyWords ?? []).filter(
				(word) => !reading.includes(word.toLowerCase())
			);
			return missing.length > 0 ? [{ line: note.line, topic: topic.name, missing }] : [];
		})
	);
}
