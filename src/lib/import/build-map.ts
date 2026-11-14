import type { CourseMap } from '#lib/db/schemas/course.ts';
import type { Block, ImportDocument, ImportError } from './ast.ts';

/** The course map an import would store, plus the name the reply gave the course. */
export interface PlannedMap extends Omit<CourseMap, 'goal' | 'next'> {
	name: string;
}

type MapBlock = Extract<
	Block,
	{ kind: 'bigpicture' | 'habit' | 'topic' | 'links' | 'cheat' | 'missing' | 'coverage' }
>;

function addBlock(map: PlannedMap, block: MapBlock): void {
	switch (block.kind) {
		case 'bigpicture':
			map.bigpicture.push(...block.lines);
			return;
		case 'habit':
			map.habit.push(...block.questions);
			return;
		case 'topic':
			// Only the map form (section lines under it); a content @topic is the builder's.
			if (block.sections.length === 0 || map.topics.some((t) => t.key === block.key)) return;
			map.topics.push({
				key: block.key,
				title: block.title,
				from: block.from,
				sections: block.sections
			});
			return;
		case 'links':
			map.links.push(...block.links);
			return;
		case 'cheat':
			map.cheat = { name: block.name, items: block.items, rows: block.rows };
			return;
		case 'missing':
			map.missing.push(...block.items);
			return;
		case 'coverage':
			map.missing.push(...block.sections);
			return;
	}
}

const MAP_KINDS = new Set<Block['kind']>([
	'bigpicture',
	'habit',
	'topic',
	'links',
	'cheat',
	'missing',
	'coverage'
]);

/**
 * Collects the course map: `@bigpicture`, `@habit`, map `@topic` entries (a `@topic` with section
 * lines under it) with their normalised `from:`, `@links`, `@cheat`, and `@missing` (legacy
 * `@coverage` too). Null when the paste has no `@map`.
 *
 * @see docs/PROMPTS.md §3 FORMAT, §6, §7 and Decisions log (Import v2: the map)
 */
export function collectMap(document: ImportDocument): {
	map: PlannedMap | null;
	errors: ImportError[];
} {
	const start = document.blocks.find((block) => block.kind === 'map');
	if (start?.kind !== 'map') return { map: null, errors: [] };
	const map: PlannedMap = {
		name: start.name,
		bigpicture: [],
		habit: [],
		topics: [],
		links: [],
		missing: []
	};
	for (const block of document.blocks) {
		if (MAP_KINDS.has(block.kind)) addBlock(map, block as MapBlock);
	}
	return { map, errors: [] };
}
