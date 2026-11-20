import { describe, expect, it } from 'vitest';
import { MC_OPTIONS } from '#lib/config/defaults.ts';
import { normalizeAnswer } from '#lib/engine/grading.ts';
import { checkResponse } from '#lib/engine/exercise-check.ts';
import type { IdeaUnitSpec, ListSpec } from '#lib/engine/exercise-spec.ts';
import { listRequired } from '#lib/engine/list-grading.ts';
import { cardId } from './fixtures.ts';
import { asShape, build, buildCourse, fact, type NoteDef } from './exercise-fixtures.ts';
import type { NoteContent } from '#lib/engine/cardgen.ts';

/**
 * The Phase 8.6 builders (`ideaUnit`, `listAll`, `listN`, `listPick`, `listNot`) and their checks,
 * through `buildExercise` and `checkResponse`.
 *
 * @see BUILD_PLAN §5.1 rows ideaUnit and listN; Decisions log "Phase 8.6 Q1" and "Q9"
 */

const MALWARE = ['virus', 'worm', 'trojan', 'ransomware', 'spyware', 'adware'];
const NETWORK = ['phishing', 'spoofing', 'sniffing', 'flooding', 'hijacking'];

const listFact = (term: string, items: string[]): NoteContent => ({
	type: 'fact',
	payload: { term, definition: items.join(', '), keyWords: items, list: true }
});
const ideaFact = (term: string, definition: string, keyWords: string[]): NoteContent => ({
	type: 'fact',
	payload: { term, definition, keyWords }
});

const two: NoteDef[] = [
	{ content: listFact('Malware types', MALWARE) },
	{ content: listFact('Network attacks', NETWORK) }
];
const alone: NoteDef[] = [{ content: listFact('Malware types', MALWARE) }];

describe('buildIdeaUnit', () => {
	const course = buildCourse([
		{
			content: ideaFact('Firewall', 'A rule set that filters network traffic', [
				'rule set',
				'filters',
				'network traffic'
			])
		}
	]);

	it('builds an ideaUnit spec from a fact fwd card with key words', () => {
		const { result } = build(course, 1, 'fwd', 'ideaUnit');
		const spec: IdeaUnitSpec = asShape(result, 'ideaUnit');
		expect(spec.kind).toBe('ideaUnit');
		expect(spec.answer).toBe('A rule set that filters network traffic');
		expect(spec.keyWords).toEqual(['rule set', 'filters', 'network traffic']);
		expect(spec.prompt).toContain('Firewall');
	});

	it('falls back to cloze for a fact without key words', () => {
		const plain = buildCourse([{ content: fact('Firewall', 'A rule set that filters traffic') }]);
		const { result, trace } = build(plain, 1, 'fwd', 'ideaUnit');
		expect(result.kind).toBe('cloze');
		expect(result.shape).toBe('type');
		expect(trace.some((entry) => entry.rule === 'exercise.fallback')).toBe(true);
	});

	it('is deterministic', () => {
		expect(build(course, 1, 'fwd', 'ideaUnit')).toEqual(build(course, 1, 'fwd', 'ideaUnit'));
	});
});

describe('buildListTyped', () => {
	it('listAll asks for every item, by typing', () => {
		const course = buildCourse(alone);
		const spec = asShape(build(course, 1, 'fwd', 'listAll').result, 'list');
		expect(spec.kind).toBe('listAll');
		expect(spec.entry).toBe('type');
		expect(spec.items).toEqual(MALWARE);
		expect(spec.required).toBe(MALWARE.length);
		expect(spec.options).toEqual([]);
		expect(spec.correct).toEqual([]);
	});

	it('listN asks for listRequired(M) items, by typing', () => {
		const course = buildCourse(alone);
		const spec = asShape(build(course, 1, 'fwd', 'listN').result, 'list');
		expect(spec.kind).toBe('listN');
		expect(spec.entry).toBe('type');
		expect(spec.items).toEqual(MALWARE);
		expect(spec.required).toBe(listRequired(MALWARE.length));
		expect(spec.options).toEqual([]);
	});

	it('falls back to mc for a fact that is not a list', () => {
		const plain = buildCourse([
			{ content: fact('Firewall', 'A rule set that filters traffic') },
			{ content: fact('Router', 'Moves packets between networks') },
			{ content: fact('Switch', 'Connects devices in a LAN') },
			{ content: fact('Hub', 'Repeats signals to all ports') }
		]);
		expect(build(plain, 1, 'fwd', 'listAll').result.kind).toBe('mc');
		expect(build(plain, 1, 'fwd', 'listN').result.kind).toBe('mc');
	});
});

describe('buildListPick', () => {
	const course = buildCourse(two);
	const norm = (texts: string[]) => texts.map(normalizeAnswer);

	it('builds a pick spec asking for listRequired(M) items', () => {
		const spec = asShape(build(course, 1, 'fwd', 'listPick').result, 'list');
		expect(spec.kind).toBe('listPick');
		expect(spec.entry).toBe('pick');
		expect(spec.items).toEqual(MALWARE);
		expect(spec.required).toBe(listRequired(MALWARE.length));
	});

	it('mixes this list items with items of other list facts; `correct` marks this list items, ascending', () => {
		const spec = asShape(build(course, 1, 'fwd', 'listPick').result, 'list');
		expect(spec.correct).toEqual([...spec.correct].sort((a, b) => a - b));
		expect(spec.correct.length).toBeGreaterThanOrEqual(spec.required);
		const wrongCount = spec.options.length - spec.correct.length;
		expect(wrongCount).toBeGreaterThanOrEqual(1);
		expect(wrongCount).toBeLessThanOrEqual(spec.items.length - spec.required);
		spec.options.forEach((option, i) => {
			const isItem = norm(MALWARE).includes(normalizeAnswer(option.text));
			expect(isItem).toBe(spec.correct.includes(i));
			if (!isItem) expect(norm(NETWORK)).toContain(normalizeAnswer(option.text));
		});
	});

	it('never offers another list item that equals one of this list items after normalising', () => {
		const clash = buildCourse([
			{ content: listFact('Malware types', MALWARE) },
			{ content: listFact('Mixed', ['  VIRUS. ', 'Worm', 'bluesnarf', 'bluejack', 'skimming']) }
		]);
		for (let attempt = 0; attempt < 15; attempt += 1) {
			const spec = asShape(build(clash, 1, 'fwd', 'listPick', { attempt }).result, 'list');
			const texts = spec.options.map((option) => normalizeAnswer(option.text));
			expect(texts.filter((text) => text === 'virus')).toHaveLength(1);
			expect(texts.filter((text) => text === 'worm')).toHaveLength(1);
		}
	});

	it('shuffles with the seeded rng: same seed same order, other attempts vary', () => {
		const a = asShape(build(course, 1, 'fwd', 'listPick').result, 'list');
		const again = asShape(build(course, 1, 'fwd', 'listPick').result, 'list');
		expect(again.options).toEqual(a.options);
		const orders = new Set<string>();
		for (let attempt = 0; attempt < 20; attempt += 1) {
			const spec = asShape(build(course, 1, 'fwd', 'listPick', { attempt }).result, 'list');
			orders.add(spec.options.map((option) => option.text).join('|'));
		}
		expect(orders.size).toBeGreaterThan(1);
	});

	it('falls back to listN when no other list fact has items', () => {
		const result = build(buildCourse(alone), 1, 'fwd', 'listPick').result;
		expect(result.kind).toBe('listN');
		expect(asShape(result, 'list').entry).toBe('type');
	});
});

describe('buildListNot', () => {
	const course = buildCourse(two);

	it('builds a choose spec: MC_OPTIONS - 1 items of the list and one item of another list', () => {
		const spec = asShape(build(course, 1, 'fwd', 'listNot').result, 'choose');
		expect(spec.kind).toBe('listNot');
		expect(spec.options).toHaveLength(MC_OPTIONS);
		const texts = spec.options.map((option) => normalizeAnswer(option.text));
		expect(new Set(texts).size).toBe(MC_OPTIONS);
		const correct = texts[spec.correctIndex] as string;
		expect(MALWARE.map(normalizeAnswer)).not.toContain(correct);
		expect(NETWORK.map(normalizeAnswer)).toContain(correct);
		texts.forEach((text, i) => {
			if (i !== spec.correctIndex) expect(MALWARE.map(normalizeAnswer)).toContain(text);
		});
	});

	it('is deterministic for the same seed', () => {
		expect(build(course, 1, 'fwd', 'listNot')).toEqual(build(course, 1, 'fwd', 'listNot'));
	});

	it('falls back to listN when no other list fact has an item', () => {
		expect(build(buildCourse(alone), 1, 'fwd', 'listNot').result.kind).toBe('listN');
	});
});

describe('checkResponse: ideaUnit', () => {
	const spec: IdeaUnitSpec = {
		shape: 'ideaUnit',
		kind: 'ideaUnit',
		cardId: cardId(1),
		prompt: 'Firewall',
		instruction: '',
		answer: 'A rule set that filters network traffic',
		keyWords: ['rule set', 'filters', 'network traffic']
	};
	const typed = 'a rule set that filters';

	it('is correct, with verdictKind ideaUnit, when every key word is ticked', () => {
		const verdict = checkResponse(spec, { shape: 'ideaUnit', typed, ticked: [0, 1, 2] }).result;
		expect(verdict.correct).toBe(true);
		expect(verdict.verdictKind).toBe('ideaUnit');
		expect(verdict.marks).toEqual([]);
		expect(verdict.chosen).toBe(typed);
	});

	it('is full weight (no override) when every tick was a pre-tick', () => {
		const verdict = checkResponse(spec, {
			shape: 'ideaUnit',
			typed: 'a rule set that filters network traffic',
			ticked: [0, 1, 2]
		}).result;
		expect(verdict.correct).toBe(true);
		expect(verdict.weight).not.toBe('recognition');
	});

	it('carries weight recognition when the student ticked a key word the app did not pre-tick', () => {
		const verdict = checkResponse(spec, { shape: 'ideaUnit', typed, ticked: [0, 1, 2] }).result;
		expect(verdict.weight).toBe('recognition');
	});

	it('is incorrect when a key word is left unticked, with marks = the unticked indexes', () => {
		const verdict = checkResponse(spec, { shape: 'ideaUnit', typed, ticked: [0] }).result;
		expect(verdict.correct).toBe(false);
		expect(verdict.verdictKind).toBe('ideaUnit');
		expect(verdict.marks).toEqual([1, 2]);
		// SPEC-GAP: the content of `reveal` (the definition? the key words?) is not stated.
	});

	it('throws when the response shape does not match the spec', () => {
		expect(() => checkResponse(spec, { shape: 'type', typed: 'x' })).toThrow();
	});
});

describe('checkResponse: list', () => {
	const typedSpec: ListSpec = {
		shape: 'list',
		kind: 'listN',
		cardId: cardId(1),
		prompt: 'Malware types',
		instruction: '',
		entry: 'type',
		items: MALWARE,
		required: 3,
		options: [],
		correct: []
	};
	const pickSpec: ListSpec = {
		...typedSpec,
		kind: 'listPick',
		entry: 'pick',
		options: ['spyware', 'phishing', 'virus', 'sniffing', 'worm'].map((text) => ({ text })),
		correct: [0, 2, 4]
	};

	it('typed: is correct with verdictKind listN when N valid items are named', () => {
		const verdict = checkResponse(typedSpec, {
			shape: 'list',
			typed: ['virus', 'worm', 'adware'],
			picked: []
		}).result;
		expect(verdict.correct).toBe(true);
		expect(verdict.verdictKind).toBe('listN');
		expect(verdict.marks).toEqual([]);
	});

	it('typed: reveals every item and marks the wrong entries by index', () => {
		const verdict = checkResponse(typedSpec, {
			shape: 'list',
			typed: ['virus', 'banana', 'worm'],
			picked: []
		}).result;
		expect(verdict.correct).toBe(false);
		expect(verdict.reveal).toEqual(MALWARE);
		expect(verdict.marks).toEqual([1]);
	});

	it('picked: is correct when no pick is wrong and enough correct options are picked', () => {
		const verdict = checkResponse(pickSpec, { shape: 'list', typed: [], picked: [4, 0, 2] }).result;
		expect(verdict.correct).toBe(true);
		expect(verdict.verdictKind).toBe('listN');
		expect(verdict.marks).toEqual([]);
	});

	it('picked: a wrong pick makes it incorrect and is marked by option index', () => {
		const verdict = checkResponse(pickSpec, {
			shape: 'list',
			typed: [],
			picked: [0, 1, 2, 4]
		}).result;
		expect(verdict.correct).toBe(false);
		expect(verdict.marks).toEqual([1]);
		expect(verdict.reveal).toEqual(MALWARE);
	});

	it('picked: too few correct picks is incorrect', () => {
		expect(
			checkResponse(pickSpec, { shape: 'list', typed: [], picked: [0, 2] }).result.correct
		).toBe(false);
	});
});
