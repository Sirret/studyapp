import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPlan, type ImportPlan, type PlannedTopic } from '#lib/import/build.ts';
import { collectMap } from '#lib/import/build-map.ts';
import { checkCompleteness } from '#lib/import/completeness.ts';
import { parseImport } from '#lib/import/parser.ts';
import { starredGaps } from '#lib/import/validate.ts';
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
			// PROMPTS §7: @deck maps to @topic, so the message names both (wording only; still skipped with an error).
			expect(build(text).errors).toEqual([
				{ line: 1, message: `${directive} comes before any @topic or @deck, so it was skipped.` }
			]);
		});

		it('reports @occlusion before any @deck', () => {
			// PROMPTS §7: @deck maps to @topic, so the message names both (wording only).
			expect(build('@occlusion a.png\n@deck A', ['a.png']).errors).toEqual([
				{ line: 1, message: '@occlusion comes before any @topic or @deck, so it was skipped.' }
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

const TOPIC = '@topic osi The OSI Model | from: I, Lecture V\n';
const ONE = '@section One\n@read\nThe broadcast domain is split.\n@fact\nx :: y\n';
const TWO = '@section Two\n@read\nr2\n@fact\np :: q\n';

/** @see docs/PROMPTS.md §3 FORMAT, §7 */
describe('buildPlan: Import v2', () => {
	it('makes a topic per key, with its title and normalised from:', () => {
		expect(onlyTopic(TOPIC + ONE + '@end')).toMatchObject({
			key: 'osi',
			name: 'The OSI Model',
			from: ['Lecture I', 'Lecture V']
		});
	});

	it('adds to the same topic when a key comes back, and a map entry does not make a second', () => {
		const { topics } = plan(`@map M\n${TOPIC}Layers\n${TOPIC}${ONE}@topic b B\n${TWO}@end`);
		expect(topics.map((topic) => topic.key)).toEqual(['osi', 'b']);
	});

	it('makes a chunk per @section with its title, priority, reading and tip', () => {
		const { chunks } = onlyTopic(
			`${TOPIC}@section One\n@priority high\n@read\nbody\n@tip\nA trick\n${TWO}@end`
		);
		expect(chunks[0]).toMatchObject({
			title: 'One',
			priority: 'high',
			text: 'body',
			tip: 'A trick'
		});
		expect(chunks[1]).toMatchObject({ title: 'Two' });
		expect(chunks[1]).not.toHaveProperty('tip');
	});

	it("attaches a section's notes to its chunk", () => {
		const { notes } = onlyTopic(`${TOPIC}${ONE}${TWO}@end`);
		expect(notes.map((note) => note.chunkIndex)).toEqual([0, 1]);
	});

	it('keeps the @summary on the topic', () => {
		expect(onlyTopic(`${TOPIC}@summary\nEssence line.\n${ONE}@end`).summary).toContain(
			'Essence line.'
		);
	});

	it('marks the "Added by the chatbot (check these)" section as added, with generated notes', () => {
		const { chunks, notes } = onlyTopic(
			`${TOPIC}${ONE}@section Added by the chatbot (check these)\n@read\n[ADDED] More.\n@fact\nz :: w [ADDED]\n@end`
		);
		expect(chunks[0]).not.toHaveProperty('added');
		expect(chunks[1]).toMatchObject({ added: true, source: 'generated' });
		expect(notes.map((note) => note.isGenerated)).toEqual([false, true]);
	});

	it('turns @link question :: answer lines into notes on the topic', () => {
		// SPEC-GAP: PROMPTS §3 gives no note type for @link cards; only their presence and text are checked.
		const { topics } = plan(
			`@topic a A\n${ONE}@topic osi The OSI Model\n${ONE}@link a\nWhy both? :: because\n@end`
		);
		const notes = topics[1]?.notes ?? [];
		expect(notes).toHaveLength(2);
		expect(JSON.stringify(notes.at(-1)?.content)).toContain('Why both?');
		expect(JSON.stringify(notes.at(-1)?.content)).toContain('because');
	});

	it('strips *key words* from a fact and stores them; a starred list makes a list fact', () => {
		const { notes } = onlyTopic(
			`${TOPIC}@section S\n@fact\nDoS :: flooding a *service* with *requests*\nThreats :: *a*, *b*, *c*\n@end`
		);
		expect(notes[0]?.content).toMatchObject({
			type: 'fact',
			payload: { definition: 'flooding a service with requests', keyWords: ['service', 'requests'] }
		});
		expect(notes[1]?.content).toMatchObject({ payload: { list: true, keyWords: ['a', 'b', 'c'] } });
	});

	it('still builds legacy @deck and @tag: a topic with no key, the tag as tag and section title', () => {
		const topic = onlyTopic('@deck A\n@tag Sec\n@read\ntext\n@fact\nx :: y\n@end');
		expect(topic.key).toBeUndefined();
		expect(topic.notes[0]?.tags).toEqual(['Sec']);
		expect(topic.chunks[0]?.title).toBe('Sec');
	});

	it('imports every complete section of a cut reply, drops the last, and marks the topic partial', () => {
		const output = plan(`${TOPIC}${ONE}${TWO}`);
		expect(output.status).toBe('cut');
		expect(output.resume).toEqual({ topicKey: 'osi', section: 'Two' });
		expect(output.topics[0]?.partial).toBe(true);
		expect(output.topics[0]?.chunks.map((chunk) => chunk.title)).toEqual(['One']);
		expect(output.topics[0]?.notes).toHaveLength(1);
	});

	it('takes @end as complete: not partial, nothing to resume', () => {
		const output = plan(`${TOPIC}${ONE}@end`);
		expect(output.status).toBe('complete');
		expect(output.resume).toBeUndefined();
		expect(output.topics[0]).not.toHaveProperty('partial');
	});

	it('accepts an @end between topics without errors and keeps the later topics', () => {
		// SPEC-GAP: PROMPTS §3 says no @end between topics; the security fixture has them. Is a mid-reply @end a stop?
		const output = plan(`${TOPIC}${ONE}@end\n@topic b B\n${TWO}@end`);
		expect(output.topics).toHaveLength(2);
		expect(output.status).toBe('complete');
	});

	it('stops cleanly at @next and resumes there', () => {
		const output = plan(`${TOPIC}${ONE}@next osi Two`);
		expect(output.status).toBe('stopped');
		expect(output.resume).toEqual({ topicKey: 'osi', section: 'Two' });
		expect(output.topics[0]?.chunks).toHaveLength(1);
		expect(output.topics[0]?.partial).toBe(true);
	});

	it('resumes at the start of a topic when @next has no section', () => {
		const output = plan(`${TOPIC}${ONE}@next b`);
		expect(output.status).toBe('stopped');
		expect(output.resume).toEqual({ topicKey: 'b' });
	});

	it('is deterministic for the same text', () => {
		expect(plan(TOPIC + ONE + TWO)).toEqual(plan(TOPIC + ONE + TWO));
	});
});

describe('checkCompleteness', () => {
	const check = (text: string) => checkCompleteness(parseImport(text).document);

	it('says complete when the last block is @end', () => {
		expect(check(`${TOPIC}${ONE}@end`).status).toBe('complete');
	});

	it('says cut for a legacy @deck paste with no @end, and drops nothing', () => {
		const done = check('@deck A\n@fact\nx :: y');
		expect(done.status).toBe('cut');
		expect(done.document.blocks.map(({ kind }) => kind)).toEqual(['deck', 'fact']);
		expect(done.droppedFromLine).toBeUndefined();
	});

	it('drops the last section of a cut v2 reply and reports the line it began on', () => {
		const done = check(`${TOPIC}${ONE}${TWO}`);
		expect(done.droppedFromLine).toBe(1 + ONE.split('\n').length);
		const titles = done.document.blocks.flatMap((b) => (b.kind === 'section' ? [b.title] : []));
		expect(titles).toEqual(['One']);
	});
});

describe('collectMap', () => {
	const collect = (text: string) => collectMap(parseImport(text).document);
	const MAP =
		'@map Sec\n@bigpicture\nA then B.\n@habit\nWhich?\n@topic osi The OSI Model | from: I\nLayers\nPDUs\n' +
		'@links\nosi -> tcp : feeds\n@cheat Table\n| | A | B |\n| x | 1 | 2 |\n@missing\nSlide 3: diagram\n';

	it('is null when there is no @map', () => {
		expect(collect(`${TOPIC}${ONE}`).map).toBeNull();
	});

	it('collects the picture, habit, planned topics, links, cheat table and missing list', () => {
		const { map, errors } = collect(MAP);
		expect(errors).toEqual([]);
		expect(map).toMatchObject({
			name: 'Sec',
			bigpicture: ['A then B.'],
			habit: ['Which?'],
			topics: [
				{ key: 'osi', title: 'The OSI Model', from: ['Lecture I'], sections: ['Layers', 'PDUs'] }
			],
			links: [{ from: 'osi', to: 'tcp', how: 'feeds' }],
			cheat: { name: 'Table', items: ['A', 'B'] },
			missing: ['Slide 3: diagram']
		});
	});

	it('leaves content topics out of the map and reads @coverage as missing', () => {
		const { map } = collect(`@map M\n${TOPIC}${ONE}@coverage\nSlide 4`);
		expect(map?.topics).toEqual([]);
		expect(map?.missing).toEqual(['Slide 4']);
	});
});

describe('starredGaps', () => {
	it('finds starred words the section reading never says, ignoring case', () => {
		const text = `${TOPIC}@section S\n@read\nThe Broadcast domain is split.\n@fact\nA :: *broadcast domain* and *VLAN*\n@end`;
		expect(starredGaps(plan(text))).toMatchObject([{ topic: 'The OSI Model', missing: ['VLAN'] }]);
	});

	it('finds nothing when every starred word is read, or the section has no reading', () => {
		const read = `${TOPIC}@section S\n@read\nA broadcast domain.\n@fact\nA :: *broadcast domain*\n@end`;
		expect(starredGaps(plan(read))).toEqual([]);
		expect(starredGaps(plan(`${TOPIC}@section S\n@fact\nA :: *anything*\n@end`))).toEqual([]);
	});
});

describe('Import v2 fixtures: plans', () => {
	const read = (name: string) => readFileSync(`tests/fixtures/import/${name}`, 'utf8');
	const count = (text: string, directive: string) =>
		text.split('\n').filter((line) => line.startsWith(directive)).length;

	it.each([
		['datacomms_reply.txt', 7],
		['security_reply.txt', 8]
	])('%s: one topic per key, one chunk per @section, every note with cards', (name, topics) => {
		const text = read(name);
		const output = build(text);
		expect(output.errors).toEqual([]);
		expect(output.plan.status).toBe('complete');
		expect(output.plan.topics).toHaveLength(topics);
		expect(output.plan.topics.flatMap((topic) => topic.chunks)).toHaveLength(
			count(text, '@section')
		);
		expect(output.plan.topics.filter((topic) => topic.summary)).toHaveLength(
			count(text, '@summary')
		);
		const notes = output.plan.topics.flatMap((topic) => topic.notes);
		expect(notes.length).toBeGreaterThan(0);
		expect(notes.every((note) => note.cards.length > 0)).toBe(true);
	});

	it('security_reply.txt: has a map with 8 planned topics and a cheat table', () => {
		const { plan: planned } = build(read('security_reply.txt'));
		expect(planned.map?.topics).toHaveLength(8);
		expect(planned.map?.cheat).toBeDefined();
	});

	it('truncated mid-section: that topic is partial, the last section dropped, a resume point set', () => {
		const all = read('datacomms_reply.txt');
		const lines = all.split('\n');
		const cutAt = lines.findIndex((line, i) => i > 60 && line.startsWith('@fact'));
		const output = build(lines.slice(0, cutAt + 2).join('\n'));
		expect(output.plan.status).toBe('cut');
		expect(output.plan.resume?.topicKey).toBe('layering');
		expect(output.plan.topics.find((topic) => topic.key === 'layering')?.partial).toBe(true);
		const chunks = output.plan.topics.flatMap((topic) => topic.chunks);
		expect(chunks.length).toBeLessThan(count(all, '@section'));
	});
});
