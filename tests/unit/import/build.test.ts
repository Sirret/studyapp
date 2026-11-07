import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildPlan, type ImportPlan, type PlannedTopic } from '#lib/import/build.ts';
import { parseImport } from '#lib/import/parser.ts';
import { fileKey } from '#lib/import/zip.ts';

function build(text: string, files: string[] = []) {
	const { document, errors } = parseImport(text);
	expect(errors).toEqual([]);
	return buildPlan(document, { files: new Set(files.map(fileKey)), newId: randomUUID });
}

function plan(text: string, files: string[] = []): ImportPlan {
	const output = build(text, files);
	expect(output.errors).toEqual([]);
	return output.plan;
}

function onlyTopic(text: string): PlannedTopic {
	const [topic] = plan(text).topics;
	if (!topic) throw new Error('No topic');
	return topic;
}

describe('buildPlan', () => {
	describe('@deck', () => {
		it('creates topics in the order they first appear', () => {
			expect(plan('@deck B\n@deck A').topics.map((topic) => topic.name)).toEqual(['B', 'A']);
		});

		it('adds to the same topic when a name comes back', () => {
			const { topics } = plan('@deck A\n@fact\na :: 1\n@deck B\n@deck A\n@fact\nb :: 2');
			expect(topics.map((topic) => topic.name)).toEqual(['A', 'B']);
			expect(topics[0]?.notes).toHaveLength(2);
		});

		it.each([
			['@tag', '@tag t\n@deck A'],
			['@priority', '@priority high\n@deck A'],
			['@read', '@read\nx\n@deck A'],
			['@keyterms', '@keyterms\nx :: y\n@deck A'],
			['@cloze', '@cloze\n{{x}}\n@deck A'],
			['@sequence', '@sequence S\na\nb\n@deck A'],
			['@compare', '@compare\n| | A | B |\n| x | 1 | 2 |\n@deck A'],
			['@scenario', '@scenario\nx :: y\n@deck A'],
			['@example', '@example E\na :: b\nc :: d\n@deck A'],
			['@diagram stack', '@diagram stack S\na\nb\n@deck A'],
			['@diagram flow', '@diagram flow F\na -> b\n@deck A']
		])('reports %s before any @deck', (directive, text) => {
			expect(build(text).errors).toEqual([
				{ line: 1, message: `${directive} comes before any @deck, so it was skipped.` }
			]);
		});

		it('reports @occlusion before any @deck', () => {
			expect(build('@occlusion a.png\n@deck A', ['a.png']).errors).toEqual([
				{ line: 1, message: '@occlusion comes before any @deck, so it was skipped.' }
			]);
		});

		it('allows @coverage before any @deck', () => {
			expect(plan('@coverage\na').coverage).toEqual(['a']);
		});
	});

	describe('sticky @tag and @priority', () => {
		it('apply to following notes until changed', () => {
			const { notes } = onlyTopic(
				'@deck A\n@fact\na :: 1\n@tag t\n@priority high\n@fact\nb :: 2\nc :: 3\n@tag u\n@priority normal\n@fact\nd :: 4'
			);
			expect(notes.map((note) => [note.tags, note.priority])).toEqual([
				[[], 'normal'],
				[['t'], 'high'],
				[['t'], 'high'],
				[['u'], 'normal']
			]);
		});

		it('reset at each @deck', () => {
			const { topics } = plan(
				'@deck A\n@tag t\n@priority high\n@fact\na :: 1\n@deck B\n@fact\nb :: 2'
			);
			expect(topics[1]?.notes[0]).toMatchObject({ tags: [], priority: 'normal' });
		});
	});

	describe('topic priority', () => {
		it('is high when any @priority high appears in the deck', () => {
			expect(onlyTopic('@deck A\n@priority high\n@priority normal').priority).toBe('high');
		});

		it('is normal otherwise', () => {
			expect(onlyTopic('@deck A\n@priority normal').priority).toBe('normal');
		});
	});

	describe('chunks', () => {
		it('attach following notes until the next @read', () => {
			const { notes, chunks } = onlyTopic(
				'@deck A\n@fact\na :: 1\n@read\none\n@fact\nb :: 2\n@read\ntwo\n@fact\nc :: 3'
			);
			expect(chunks.map((chunk) => chunk.text)).toEqual(['one', 'two']);
			expect(notes.map((note) => note.chunkIndex)).toEqual([undefined, 0, 1]);
		});

		it('do not carry over a @deck', () => {
			const { topics } = plan('@deck A\n@read\none\n@deck B\n@fact\nb :: 2');
			expect(topics[1]?.notes[0]?.chunkIndex).toBeUndefined();
		});

		it('do not carry over a returning @deck', () => {
			const { topics } = plan('@deck A\n@read\none\n@deck B\n@deck A\n@fact\nb :: 2');
			expect(topics[0]?.notes[0]?.chunkIndex).toBeUndefined();
		});

		it('number chunks across a returning @deck', () => {
			const { topics } = plan('@deck A\n@read\none\n@deck A\n@read\ntwo\n@fact\nb :: 2');
			expect(topics[0]?.notes[0]?.chunkIndex).toBe(1);
		});

		it('count words on any whitespace', () => {
			expect(onlyTopic('@deck A\n@read\none  two\nthree').chunks[0]?.words).toBe(3);
		});

		it('mark [GENERATED] chunks and their notes', () => {
			const { chunks, notes } = onlyTopic(
				'@deck A\n@read\n[GENERATED] one\n@fact\na :: 1\n@read\ntwo\n@fact\nb :: 2'
			);
			expect(chunks.map((chunk) => chunk.source)).toEqual(['generated', 'notes']);
			expect(notes.map((note) => note.isGenerated)).toEqual([true, false]);
		});

		it('keep [CHECK] from @read, and leave check unset otherwise', () => {
			const { chunks } = onlyTopic('@deck A\n@read\none [CHECK]\n@read\ntwo');
			expect(chunks[0]?.check).toBe(true);
			expect(chunks[1]).not.toHaveProperty('check');
		});
	});

	describe('@keyterms belongs to the chunk it introduces', () => {
		it('attaches to the @read right after it', () => {
			const { notes } = onlyTopic('@deck A\n@keyterms\nk :: m\n@read\none');
			expect(notes[0]?.chunkIndex).toBe(0);
		});

		it('looks past @tag and @priority to find that @read', () => {
			const { notes } = onlyTopic('@deck A\n@keyterms\nk :: m\n@tag t\n@priority high\n@read\none');
			expect(notes[0]?.chunkIndex).toBe(0);
		});

		it('takes generated from that @read', () => {
			const { notes } = onlyTopic('@deck A\n@keyterms\nk :: m\n@read\n[GENERATED] one');
			expect(notes[0]?.isGenerated).toBe(true);
		});

		it('attaches adjacent @keyterms blocks to the same chunk', () => {
			const { notes } = onlyTopic('@deck A\n@keyterms\nk :: m\n@keyterms\nl :: n\n@read\none');
			expect(notes.map((note) => note.chunkIndex)).toEqual([0, 0]);
		});

		it('attaches to the current chunk when no @read follows', () => {
			const { notes } = onlyTopic(
				'@deck A\n@read\none\n@keyterms\nk :: m\n@fact\na :: 1\n@read\ntwo'
			);
			expect(notes.map((note) => note.chunkIndex)).toEqual([0, 0]);
		});

		it('has no chunk when there is none before or right after it', () => {
			const { notes } = onlyTopic('@deck A\n@keyterms\nk :: m\n@fact\na :: 1');
			expect(notes[0]?.chunkIndex).toBeUndefined();
		});

		it('does not reach into the next deck', () => {
			const { topics } = plan('@deck A\n@keyterms\nk :: m\n@deck B\n@read\none');
			expect(topics[0]?.notes[0]?.chunkIndex).toBeUndefined();
		});
	});

	describe('[CHECK]', () => {
		it('is carried to each note', () => {
			const { notes } = onlyTopic('@deck A\n@fact\na :: 1 [CHECK]\nb :: 2');
			expect(notes.map((note) => note.isChecked)).toEqual([true, false]);
		});
	});

	describe('images', () => {
		it('plans an occlusion note by file name, with no boxes and no cards yet', () => {
			const { notes } = plan('@deck A\n@occlusion Slide.PNG', ['slide.png']).topics[0] ?? {};
			expect(notes?.[0]?.content).toEqual({ type: 'occlusion', file: 'Slide.PNG' });
			expect(notes?.[0]?.cards).toEqual([]);
		});

		it('keeps a diagram source file', () => {
			const { notes } =
				plan('@deck A\n@diagram stack S\nsource: s.png\nA\nB', ['s.png']).topics[0] ?? {};
			expect(notes?.[0]?.sourceFile).toBe('s.png');
		});

		it('reports a diagram source that is not attached and skips the note', () => {
			const output = build('@deck A\n@diagram flow F\nsource: gone.png\nA -> B');
			expect(output.errors).toEqual([{ line: 2, message: 'Image "gone.png" is not attached.' }]);
			expect(output.plan.topics[0]?.notes).toEqual([]);
		});

		it('reports @occlusion with no attached image and skips the note', () => {
			const output = build('@deck A\n@occlusion gone.png');
			expect(output.errors).toEqual([{ line: 2, message: 'Image "gone.png" is not attached.' }]);
			expect(output.plan.topics[0]?.notes).toEqual([]);
		});
	});

	describe('diagrams', () => {
		it('gives a flow node one ID however many arrows name it', () => {
			const { notes } = onlyTopic('@deck A\n@diagram flow F\nA -> B\nB -> A');
			const content = notes[0]?.content;
			if (content?.type !== 'diagram') throw new Error('Not a diagram');
			expect(content.payload.nodes.map((node) => node.label)).toEqual(['A', 'B']);
			const [a, b] = content.payload.nodes;
			expect(content.payload.edges.map((edge) => [edge.from, edge.to])).toEqual([
				[a?.id, b?.id],
				[b?.id, a?.id]
			]);
		});

		it('uses the injected ID source, so a build can be repeated exactly', () => {
			const { document } = parseImport('@deck A\n@diagram flow F\nA -> B : c');
			const buildOnce = () => {
				let next = 0;
				return buildPlan(document, {
					files: new Set(),
					newId: () => `00000000-0000-4000-8000-${String(++next).padStart(12, '0')}`
				});
			};
			expect(buildOnce()).toEqual(buildOnce());
		});
	});
});

describe('fileKey', () => {
	it('matches on the base name, ignoring case and folders', () => {
		expect(fileKey('images/Slide 12.PNG')).toBe('slide 12.png');
		expect(fileKey('images\\Slide.png')).toBe('slide.png');
		expect(fileKey('slide.png')).toBe('slide.png');
	});
});
