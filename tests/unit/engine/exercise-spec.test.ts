import { describe, expect, it } from 'vitest';
import {
	BANK_SIZE,
	BLURT_TITLE_CHARS,
	MATCHING_PAIRS,
	MC_OPTIONS,
	MC_UNTIL_ACCURACY,
	PARSONS_EXTRAS
} from '#lib/config/defaults.ts';
import type { ExerciseKind } from '#lib/db/schemas/common.ts';
import {
	exerciseKindFor,
	promptFor,
	type ExerciseSpec,
	type KindInput
} from '#lib/engine/exercise-spec.ts';
import { normalizeAnswer } from '#lib/engine/grading.ts';
import { createRng } from '#lib/engine/rng.ts';
import {
	asShape,
	build,
	buildCourse,
	cardIdOf,
	cardOf,
	cloze,
	compare,
	example,
	fact,
	keyterm,
	noteOf,
	scenario,
	sequence,
	sorted,
	type TestCourse
} from './exercise-fixtures.ts';

const ATTEMPTS = Array.from({ length: 24 }, (_, i) => i);
const texts = (options: readonly { text: string }[]): string[] => options.map((o) => o.text);
const norm = (values: readonly string[]): string[] => sorted(values.map(normalizeAnswer));

/** Builds over many attempts and counts the distinct results of `view`. */
function distinctOver(make: (attempt: number) => ExerciseSpec, view: (s: ExerciseSpec) => unknown) {
	return new Set(ATTEMPTS.map((attempt) => JSON.stringify(view(make(attempt))))).size;
}

// ---------------------------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------------------------

/** The prompt of the card each term answer belongs to (keyterm fwd → meaning, fact rev → def). */
const NET_PROMPTS: Record<string, string> = {
	UDP: 'connectionless datagrams',
	DNS: 'name resolution',
	ARP: 'address resolution',
	ICMP: 'error reporting',
	IP: 'routes packets between hosts'
};
const NET_TERMS = ['TCP', 'UDP', 'DNS', 'ARP', 'ICMP', 'IP'];

/** 1 TCP · 2 UDP · 3 DNS · 4 ARP · 5 ICMP · 6 fact IP · 7 Handshake sequence. */
const NET = buildCourse([
	{ content: keyterm('TCP', 'reliable byte stream'), accept: { fwd: ['Transmission Control'] } },
	{ content: keyterm('UDP', NET_PROMPTS.UDP ?? '') },
	{ content: keyterm('DNS', NET_PROMPTS.DNS ?? '') },
	{ content: keyterm('ARP', NET_PROMPTS.ARP ?? '') },
	{ content: keyterm('ICMP', NET_PROMPTS.ICMP ?? '') },
	{ content: fact('IP', NET_PROMPTS.IP ?? '') },
	{ content: sequence('Handshake', ['SYN', 'SYN-ACK', 'ACK', 'DATA']) }
]);

/** 1 TCP, with a T-bank: 2 TLS · 3 TFTP · 4 Telnet; 5 UDP is the wrong letter. */
const TEE = buildCourse([
	{ content: keyterm('TCP', 'reliable byte stream') },
	{ content: keyterm('TLS', 'encrypted channel') },
	{ content: keyterm('TFTP', 'trivial file transfer') },
	{ content: keyterm('Telnet', 'remote terminal') },
	{ content: keyterm('UDP', 'datagrams') }
]);

/** Only one other T answer: the bank is null. */
const SPARSE_T = buildCourse([
	{ content: keyterm('TCP', 'reliable byte stream') },
	{ content: keyterm('TLS', 'encrypted channel') },
	{ content: keyterm('UDP', 'datagrams') },
	{ content: keyterm('DNS', 'names') }
]);

const FILLERS = [
	{ content: keyterm('alpha', 'first') },
	{ content: keyterm('beta', 'second') },
	{ content: keyterm('gamma', 'third') },
	{ content: keyterm('delta', 'fourth') }
];

const CMP_ITEMS = ['TCP', 'UDP', 'QUIC'];
const CMP_ROWS: [string, string[]][] = [
	['Delivery', ['guaranteed', 'best effort', 'stream-level']],
	['Setup', ['handshake', 'none', '0-RTT']],
	['Header', ['20 bytes', '8 bytes', 'varies']],
	['Order', ['ordered', 'unordered', 'per stream']]
];
const value = (r: number, c: number): string => CMP_ROWS[r]?.[1][c] ?? '';
/** 1 the compare note (4 rows, 3 items) · 2–5 fillers. */
const CMP = buildCourse([{ content: compare(CMP_ITEMS, CMP_ROWS) }, ...FILLERS]);

const SOLVE_STEPS: [string, string][] = [
	['isolate x', 'x = 4'],
	['substitute', 'y = 8'],
	['check', '4 + 8 = 12']
];
/** 1 Handshake · 2 Boot (its "syn!" equals SYN after normalising) · 3 Solve example. */
const SEQ = buildCourse([
	{ content: sequence('Handshake', ['SYN', 'SYN-ACK', 'ACK', 'DATA']) },
	{ content: sequence('Boot', ['syn!', 'POST', 'Kernel', 'Login']) },
	{ content: example('Solve', SOLVE_STEPS) }
]);

const CLOZE_TEXT = 'The {{CPU}} runs {{instructions}} from {{memory}}.';
const LONG_CLOZE =
	'Virtual memory lets each process see a private address space larger than RAM, using {{paging}}.';
/** One of each non-diagram note type. */
const ALL = buildCourse([
	{ content: keyterm('TCP', 'reliable byte stream') },
	{ content: fact('IP', 'routes packets between hosts') },
	{ content: cloze(CLOZE_TEXT) },
	{ content: sequence('Handshake', ['SYN', 'SYN-ACK', 'ACK', 'DATA']) },
	{ content: example('Solve', SOLVE_STEPS) },
	{ content: compare(['TCP', 'UDP'], [['Reliable', ['yes', 'no']]]) },
	{ content: scenario('Live video call', 'UDP') },
	{ content: cloze(LONG_CLOZE) }
]);

// ---------------------------------------------------------------------------------------------
// exerciseKindFor
// ---------------------------------------------------------------------------------------------

describe('exerciseKindFor', () => {
	const kindInput = (overrides: Partial<KindInput>): KindInput => ({
		path: ['mc', 'cloze'],
		pathStep: 0,
		accuracy: { n: 0, correct: 0 },
		spellingMode: 'fuzzy',
		missedTyped: false,
		...overrides
	});
	/** Enough correct first attempts to pass MC_UNTIL_ACCURACY. */
	const ACCURATE = { n: 100, correct: Math.ceil(100 * MC_UNTIL_ACCURACY) };

	it('is currentKind for the card: mc while accuracy is low', () => {
		expect(exerciseKindFor(kindInput({}))).toBe('mc');
	});

	it('is currentKind for the card: skips mc once accuracy reaches MC_UNTIL_ACCURACY', () => {
		expect(exerciseKindFor(kindInput({ accuracy: ACCURATE }))).toBe('cloze');
	});

	it('keeps a cloze step as cloze in fuzzy spelling mode with no missed typed answer', () => {
		expect(exerciseKindFor(kindInput({ path: ['cloze'] }))).toBe('cloze');
	});

	it('turns a cloze step into firstLetterBank in firstLetter spelling mode', () => {
		const input = kindInput({ path: ['cloze'], spellingMode: 'firstLetter' });
		expect(exerciseKindFor(input)).toBe('firstLetterBank');
	});

	it('turns a cloze step into firstLetterBank right after a missed typed answer', () => {
		expect(exerciseKindFor(kindInput({ path: ['cloze'], missedTyped: true }))).toBe(
			'firstLetterBank'
		);
	});

	it('turns the cloze step reached after mc into firstLetterBank too', () => {
		const input = kindInput({ pathStep: 1, spellingMode: 'firstLetter' });
		expect(exerciseKindFor(input)).toBe('firstLetterBank');
	});

	it('leaves an mc step alone in firstLetter mode and after a missed typed answer', () => {
		const input = kindInput({ spellingMode: 'firstLetter', missedTyped: true });
		expect(exerciseKindFor(input)).toBe('mc');
	});

	const notCloze: ExerciseKind[] = [
		'fadeStep',
		'newInstance',
		'whichOne',
		'sequence',
		'parsons',
		'tableRow',
		'scenario',
		'exampleStudy',
		'subgoalMatch'
	];
	it.each(notCloze)('only changes cloze steps: %s stays as it is', (kind) => {
		const input = kindInput({ path: [kind], spellingMode: 'firstLetter', missedTyped: true });
		expect(exerciseKindFor(input)).toBe(kind);
	});

	it('follows currentKind on a step-card path (whichOne → cloze) past the first step', () => {
		const path: ExerciseKind[] = ['whichOne', 'cloze'];
		expect(exerciseKindFor(kindInput({ path, pathStep: 1 }))).toBe('cloze');
		expect(exerciseKindFor(kindInput({ path, pathStep: 1, missedTyped: true }))).toBe(
			'firstLetterBank'
		);
	});
});

// ---------------------------------------------------------------------------------------------
// promptFor
// ---------------------------------------------------------------------------------------------

describe('promptFor', () => {
	const rng = () => createRng(7);
	const prompt = (course: TestCourse, n: number, variant: string) =>
		promptFor(noteOf(course, n), variant, rng());

	it('keyterm fwd → the meaning', () => {
		expect(prompt(ALL, 1, 'fwd')).toStrictEqual({ text: 'reliable byte stream' });
	});

	it('fact fwd → the term', () => {
		expect(prompt(ALL, 2, 'fwd').text).toBe('IP');
	});

	it('fact rev → the definition', () => {
		expect(prompt(ALL, 2, 'rev').text).toBe('routes packets between hosts');
	});

	it('cloze cN → span N blanked, the other spans filled in', () => {
		expect(prompt(ALL, 3, 'c1').text).toBe('The _____ runs instructions from memory.');
		expect(prompt(ALL, 3, 'c2').text).toBe('The CPU runs _____ from memory.');
		expect(prompt(ALL, 3, 'c3').text).toBe('The CPU runs instructions from _____.');
	});

	it('step:i → <name>: what comes after "<step i>"?', () => {
		expect(prompt(ALL, 4, 'step:0').text).toBe('Handshake: what comes after "SYN"?');
		expect(prompt(ALL, 4, 'step:2').text).toBe('Handshake: what comes after "ACK"?');
	});

	it('seq → Put the steps of <name> in order', () => {
		expect(prompt(ALL, 4, 'seq').text).toBe('Put the steps of Handshake in order');
	});

	it('ex → the example name', () => {
		expect(prompt(ALL, 5, 'ex').text).toBe('Solve');
	});

	it('cell:r:c → <item c> — <attribute r>', () => {
		expect(prompt(CMP, 1, 'cell:1:2').text).toBe('QUIC — Setup');
		expect(prompt(CMP, 1, 'cell:0:0').text).toBe('TCP — Delivery');
	});

	it('row:r → <attribute r>: match each to its value', () => {
		expect(prompt(CMP, 1, 'row:2').text).toBe('Header: match each to its value');
	});

	it('scenario fwd → the situation', () => {
		expect(prompt(ALL, 7, 'fwd').text).toBe('Live video call');
	});

	it('which:r → Which one has <attribute r>: <value>? for the item the rng chose', () => {
		const { text, item } = prompt(CMP, 1, 'which:1');
		expect(item).toBeTypeOf('number');
		expect(text).toBe(`Which one has Setup: ${value(1, item ?? -1)}?`);
	});

	it('which:r picks the same item for the same seed', () => {
		const note = noteOf(CMP, 1);
		expect(promptFor(note, 'which:0', createRng(42))).toStrictEqual(
			promptFor(note, 'which:0', createRng(42))
		);
	});

	it('which:r can pick every item across seeds', () => {
		const note = noteOf(CMP, 1);
		const items = new Set(ATTEMPTS.map((seed) => promptFor(note, 'which:0', createRng(seed)).item));
		expect([...items].sort()).toStrictEqual([0, 1, 2]);
	});

	it('leaves item undefined for every variant other than which:r', () => {
		const cases: [TestCourse, number, string][] = [
			[ALL, 1, 'fwd'],
			[ALL, 2, 'rev'],
			[ALL, 3, 'c1'],
			[ALL, 4, 'step:0'],
			[ALL, 4, 'seq'],
			[ALL, 5, 'ex'],
			[CMP, 1, 'cell:0:0'],
			[CMP, 1, 'row:0'],
			[ALL, 7, 'fwd']
		];
		for (const [course, n, variant] of cases) {
			expect(prompt(course, n, variant).item).toBeUndefined();
		}
	});
});

// ---------------------------------------------------------------------------------------------
// buildExercise: every spec
// ---------------------------------------------------------------------------------------------

describe('buildExercise: common fields', () => {
	const cases: [string, TestCourse, number, string, ExerciseKind][] = [
		['cloze', NET, 1, 'fwd', 'cloze'],
		['firstLetterType', NET, 1, 'fwd', 'firstLetterType'],
		['firstLetterBank', TEE, 1, 'fwd', 'firstLetterBank'],
		['mc', NET, 1, 'fwd', 'mc'],
		['pretest', NET, 1, 'fwd', 'pretest'],
		['whichOne step', NET, 7, 'step:0', 'whichOne'],
		['whichOne which', CMP, 1, 'which:1', 'whichOne'],
		['scenario', ALL, 7, 'fwd', 'scenario'],
		['oddOneOut', CMP, 1, 'cell:0:0', 'oddOneOut'],
		['multiSelect', CMP, 1, 'cell:0:1', 'multiSelect'],
		['pickPrinciple', CMP, 1, 'row:1', 'pickPrinciple'],
		['tableRow', CMP, 1, 'row:1', 'tableRow'],
		['categorize', CMP, 1, 'cell:0:0', 'categorize'],
		['sequence', SEQ, 1, 'seq', 'sequence'],
		['parsons', SEQ, 1, 'seq', 'parsons'],
		['subgoalMatch', SEQ, 3, 'ex', 'subgoalMatch'],
		['fadeStep', SEQ, 3, 'ex', 'fadeStep'],
		['newInstance', SEQ, 3, 'ex', 'newInstance'],
		['exampleStudy', SEQ, 3, 'ex', 'exampleStudy'],
		['matching', NET, 1, 'fwd', 'matching'],
		['flip', NET, 1, 'fwd', 'flip'],
		['explainIt', ALL, 3, 'c1', 'explainIt'],
		['blurt', ALL, 4, 'seq', 'blurt']
	];

	it.each(cases)(
		'%s: is the requested kind, for the card, with a prompt and instruction',
		(_, course, n, variant, kind) => {
			const { result } = build(course, n, variant, kind);
			expect(result.kind).toBe(kind);
			expect(result.cardId).toBe(cardOf(course, n, variant).id);
			expect(result.prompt.length).toBeGreaterThan(0);
			expect(result.instruction.length).toBeGreaterThan(0);
		}
	);

	it.each(cases)(
		'%s: same input and seed give an identical spec and trace',
		(_, course, n, variant, kind) => {
			expect(build(course, n, variant, kind, { attempt: 3 })).toStrictEqual(
				build(course, n, variant, kind, { attempt: 3 })
			);
		}
	);

	it('uses promptFor for the card prompt of text-answer kinds', () => {
		const note = noteOf(NET, 1);
		const expected = promptFor(note, 'fwd', createRng(1)).text;
		for (const kind of ['cloze', 'firstLetterType', 'mc', 'pretest'] as const) {
			expect(build(NET, 1, 'fwd', kind).result.prompt).toBe(expected);
		}
	});
});

describe('buildExercise: cloze and firstLetterType', () => {
	it('cloze: type shape with the answer, accept[variant], no letter and no context', () => {
		const spec = asShape(build(NET, 1, 'fwd', 'cloze').result, 'type');
		expect(spec.answer).toBe('TCP');
		expect(spec.accepted).toStrictEqual(['Transmission Control']);
		expect(spec.letter).toBeNull();
		expect(spec.context).toStrictEqual([]);
	});

	it('cloze: others carries the course answers of every kind, with their card IDs', () => {
		const spec = asShape(build(NET, 1, 'fwd', 'cloze').result, 'type');
		expect(spec.others).toContainEqual({ cardId: cardIdOf(2, 0), text: 'UDP' });
		expect(spec.others).toContainEqual({ cardId: cardIdOf(6, 0), text: NET_PROMPTS.IP });
		expect(spec.others).toContainEqual({ cardId: cardIdOf(6, 1), text: 'IP' });
		expect(spec.others).toContainEqual({ cardId: cardIdOf(7, 1), text: 'SYN-ACK' });
	});

	it('cloze: an empty accept list when the note has none for the variant', () => {
		expect(asShape(build(NET, 2, 'fwd', 'cloze').result, 'type').accepted).toStrictEqual([]);
	});

	it('cloze: works for every text-answer variant (cloze span, step, cell, scenario, fact rev)', () => {
		const cases: [TestCourse, number, string, string][] = [
			[ALL, 3, 'c2', 'instructions'],
			[ALL, 4, 'step:1', 'ACK'],
			[CMP, 1, 'cell:2:1', '8 bytes'],
			[ALL, 7, 'fwd', 'UDP'],
			[ALL, 2, 'fwd', 'routes packets between hosts'],
			[ALL, 2, 'rev', 'IP']
		];
		for (const [course, n, variant, answer] of cases) {
			expect(asShape(build(course, n, variant, 'cloze').result, 'type').answer).toBe(answer);
		}
	});

	it('cloze falls back to flip for a card with no text answer, and the trace says so', () => {
		const { result, trace } = build(ALL, 4, 'seq', 'cloze');
		expect(result.kind).toBe('flip');
		asShape(result, 'selfRate');
		expect(trace.length).toBeGreaterThan(0);
	});

	it('firstLetterType: as cloze, plus the first letter of the answer', () => {
		const spec = asShape(build(NET, 1, 'fwd', 'firstLetterType').result, 'type');
		expect(spec.kind).toBe('firstLetterType');
		expect(spec.answer).toBe('TCP');
		// SPEC-GAP: is the hint letter the raw first character ("T") or the normalised one ("t")?
		// Compared case-insensitively here.
		expect(spec.letter?.toLowerCase()).toBe('t');
	});

	it('firstLetterType falls back as cloze: flip for a card with no text answer', () => {
		expect(build(ALL, 5, 'ex', 'firstLetterType').result.kind).toBe('flip');
	});
});

describe('buildExercise: firstLetterBank', () => {
	it('offers BANK_SIZE options all starting with the letter, the answer at correctIndex', () => {
		const spec = asShape(build(TEE, 1, 'fwd', 'firstLetterBank').result, 'choose');
		expect(spec.kind).toBe('firstLetterBank');
		expect(spec.letter).toBe('t');
		expect(spec.options).toHaveLength(BANK_SIZE);
		expect(spec.options[spec.correctIndex]?.text).toBe('TCP');
		for (const option of spec.options)
			expect(normalizeAnswer(option.text).startsWith('t')).toBe(true);
		expect(texts(spec.options)).not.toContain('UDP');
	});

	it('marks bank options from other cards with that card and its prompt', () => {
		const spec = asShape(build(TEE, 1, 'fwd', 'firstLetterBank').result, 'choose');
		const prompts: Record<string, string> = {
			TLS: 'encrypted channel',
			TFTP: 'trivial file transfer',
			Telnet: 'remote terminal'
		};
		spec.options
			.filter((_, i) => i !== spec.correctIndex)
			.forEach((option) => {
				expect(option.cardId).toBeDefined();
				expect(option.answers).toBe(prompts[option.text]);
			});
	});

	it('falls back to firstLetterType when the bank is null (fewer than 3 candidates)', () => {
		const spec = asShape(build(SPARSE_T, 1, 'fwd', 'firstLetterBank').result, 'type');
		expect(spec.kind).toBe('firstLetterType');
		expect(spec.answer).toBe('TCP');
		expect(spec.letter?.toLowerCase()).toBe('t');
	});

	// SPEC-GAP: the table says "As cloze"; read as inheriting cloze's own fallback (flip) when the
	// card has no text answer.
	it('falls back to flip for a card with no text answer', () => {
		expect(build(ALL, 4, 'seq', 'firstLetterBank').result.kind).toBe('flip');
	});

	it('reshuffles the bank for another attempt', () => {
		const make = (attempt: number) => build(TEE, 1, 'fwd', 'firstLetterBank', { attempt }).result;
		expect(
			distinctOver(make, (s) => (s.shape === 'choose' ? s.correctIndex : null))
		).toBeGreaterThan(1);
	});
});

describe('buildExercise: mc and pretest', () => {
	it('mc: MC_OPTIONS distinct options, the answer at correctIndex, no letter', () => {
		const spec = asShape(build(NET, 1, 'fwd', 'mc').result, 'choose');
		expect(spec.kind).toBe('mc');
		expect(spec.options).toHaveLength(MC_OPTIONS);
		expect(spec.options[spec.correctIndex]?.text).toBe('TCP');
		expect(new Set(texts(spec.options)).size).toBe(MC_OPTIONS);
		expect(spec.letter).toBeNull();
	});

	it('mc: distractors are answers of the same kind (terms, never definitions or steps)', () => {
		const spec = asShape(build(NET, 1, 'fwd', 'mc').result, 'choose');
		for (const text of texts(spec.options)) expect(NET_TERMS).toContain(text);
	});

	it('mc: each distractor names its card and that card prompt, for contrastive feedback', () => {
		const spec = asShape(build(NET, 1, 'fwd', 'mc').result, 'choose');
		spec.options
			.filter((_, i) => i !== spec.correctIndex)
			.forEach((option) => {
				expect(option.cardId).toBeDefined();
				expect(option.answers).toBe(NET_PROMPTS[option.text]);
			});
	});

	it('mc: never offers an accepted synonym of the answer', () => {
		const course = buildCourse([
			{ content: keyterm('TCP', 'stream'), accept: { fwd: ['Transmission Control'] } },
			{ content: keyterm('Transmission Control', 'a long name') },
			{ content: keyterm('UDP', 'datagrams') }
		]);
		const spec = asShape(build(course, 1, 'fwd', 'mc').result, 'choose');
		expect(sorted(texts(spec.options))).toStrictEqual(['TCP', 'UDP']);
	});

	it('mc: passes logged confusions on, so a confused card is offered', () => {
		const confusions = new Map([[cardIdOf(5, 0), 5]]);
		const spec = asShape(build(NET, 1, 'fwd', 'mc', { confusions }).result, 'choose');
		expect(texts(spec.options)).toContain('ICMP');
	});

	it('mc: reshuffles the options for another attempt', () => {
		const make = (attempt: number) => build(NET, 1, 'fwd', 'mc', { attempt }).result;
		expect(
			distinctOver(make, (s) => (s.shape === 'choose' ? s.correctIndex : null))
		).toBeGreaterThan(1);
	});

	it('mc falls back to cloze when there is no distractor', () => {
		const course = buildCourse([{ content: keyterm('TCP', 'stream') }]);
		const spec = asShape(build(course, 1, 'fwd', 'mc').result, 'type');
		expect(spec.kind).toBe('cloze');
		expect(spec.answer).toBe('TCP');
	});

	it('mc on a card with no text answer ends at flip (cloze falls back to flip)', () => {
		expect(build(NET, 7, 'seq', 'mc').result.kind).toBe('flip');
	});

	it('pretest: as mc, with kind pretest', () => {
		const spec = asShape(build(NET, 1, 'fwd', 'pretest').result, 'choose');
		expect(spec.kind).toBe('pretest');
		expect(spec.options).toHaveLength(MC_OPTIONS);
		expect(spec.options[spec.correctIndex]?.text).toBe('TCP');
	});

	it('pretest falls back to flip when there is no distractor', () => {
		const course = buildCourse([{ content: keyterm('TCP', 'stream') }]);
		const spec = asShape(build(course, 1, 'fwd', 'pretest').result, 'selfRate');
		expect(spec.kind).toBe('flip');
		expect(spec.answer).toBe('TCP');
	});
});

describe('buildExercise: whichOne and scenario', () => {
	const HANDSHAKE = buildCourse([
		{ content: sequence('Handshake', ['SYN', 'SYN-ACK', 'ACK', 'DATA']) }
	]);

	// SPEC-GAP: "the other steps as options (pickDistractors)" read as step answers of the course, so
	// step 0 (no card's answer) may or may not appear; only options within the note's steps is checked.
	it('whichOne on step:i: the other steps as options, the next step correct', () => {
		const spec = asShape(build(HANDSHAKE, 1, 'step:0', 'whichOne').result, 'choose');
		expect(spec.kind).toBe('whichOne');
		expect(spec.options[spec.correctIndex]?.text).toBe('SYN-ACK');
		expect(sorted(texts(spec.options))).toStrictEqual(sorted(['SYN-ACK', 'ACK', 'DATA']));
	});

	it('whichOne on step:i prefers the sequence own steps over other sequences', () => {
		const spec = asShape(build(SEQ, 1, 'step:0', 'whichOne').result, 'choose');
		expect(texts(spec.options)).toEqual(expect.arrayContaining(['SYN-ACK', 'ACK', 'DATA']));
	});

	/** The item whose row-r value the prompt names. */
	function itemInPrompt(prompt: string, r: number, attribute: string): number {
		return CMP_ITEMS.findIndex((_, c) => prompt === `Which one has ${attribute}: ${value(r, c)}?`);
	}

	it('whichOne on which:r: the items as options; the answer is the item the prompt chose', () => {
		for (const attempt of [0, 1, 2, 3]) {
			const spec = asShape(build(CMP, 1, 'which:1', 'whichOne', { attempt }).result, 'choose');
			expect(sorted(texts(spec.options))).toStrictEqual(sorted(CMP_ITEMS));
			const item = itemInPrompt(spec.prompt, 1, 'Setup');
			expect(item).toBeGreaterThanOrEqual(0);
			expect(spec.options[spec.correctIndex]?.text).toBe(CMP_ITEMS[item]);
		}
	});

	it('whichOne on which:r: the chosen item varies with the seed', () => {
		const make = (attempt: number) => build(CMP, 1, 'which:1', 'whichOne', { attempt }).result;
		expect(distinctOver(make, (s) => s.prompt)).toBeGreaterThan(1);
	});

	it('whichOne falls back to mc for other cards', () => {
		expect(build(NET, 1, 'fwd', 'whichOne').result.kind).toBe('mc');
	});

	it('scenario fwd: pickDistractors options around the scenario answer', () => {
		const course = buildCourse([
			{ content: scenario('Live video call', 'UDP') },
			{ content: keyterm('TCP', 'stream') },
			{ content: keyterm('DNS', 'names') },
			{ content: keyterm('ARP', 'addresses') }
		]);
		const spec = asShape(build(course, 1, 'fwd', 'scenario').result, 'choose');
		expect(spec.kind).toBe('scenario');
		expect(spec.prompt).toBe('Live video call');
		expect(spec.options[spec.correctIndex]?.text).toBe('UDP');
		expect(sorted(texts(spec.options))).toStrictEqual(['ARP', 'DNS', 'TCP', 'UDP']);
	});

	it('scenario on which:r: as whichOne, with the instruction "Pick the one that fits"', () => {
		const spec = asShape(build(CMP, 1, 'which:2', 'scenario').result, 'choose');
		expect(spec.kind).toBe('scenario');
		expect(spec.instruction).toBe('Pick the one that fits');
		expect(sorted(texts(spec.options))).toStrictEqual(sorted(CMP_ITEMS));
		const item = itemInPrompt(spec.prompt, 2, 'Header');
		expect(spec.options[spec.correctIndex]?.text).toBe(CMP_ITEMS[item]);
	});

	it('scenario falls back to mc for other cards', () => {
		expect(build(NET, 1, 'fwd', 'scenario').result.kind).toBe('mc');
	});
});

describe('buildExercise: oddOneOut', () => {
	function odd(variant: string, three: string[], oddValue: string) {
		const spec = asShape(build(CMP, 1, variant, 'oddOneOut').result, 'choose');
		expect(spec.kind).toBe('oddOneOut');
		expect(sorted(texts(spec.options))).toStrictEqual(sorted([...three, oddValue]));
		expect(spec.options[spec.correctIndex]?.text).toBe(oddValue);
	}

	it('item c in row r and the next two, plus item c+1 in row r; the odd one is correct', () => {
		odd('cell:0:0', [value(0, 0), value(1, 0), value(2, 0)], value(0, 1));
	});

	it('wraps the rows past the last row', () => {
		odd('cell:3:0', [value(3, 0), value(0, 0), value(1, 0)], value(3, 1));
	});

	it('wraps the odd item past the last item', () => {
		odd('cell:2:2', [value(2, 2), value(3, 2), value(0, 2)], value(2, 0));
	});

	it('falls back to mc when the note has fewer than 3 rows', () => {
		const course = buildCourse([
			{
				content: compare(
					['A', 'B'],
					[
						['r0', ['p', 'q']],
						['r1', ['s', 't']]
					]
				)
			},
			...FILLERS
		]);
		expect(build(course, 1, 'cell:0:0', 'oddOneOut').result.kind).toBe('mc');
	});

	it('falls back to mc when the odd value equals one of the three after normalising', () => {
		const rows: [string, string[]][] = [
			['r0', ['p', 'Q!']],
			['r1', ['q', 's']],
			['r2', ['t', 'u']]
		];
		const course = buildCourse([{ content: compare(['A', 'B'], rows) }, ...FILLERS]);
		expect(build(course, 1, 'cell:0:0', 'oddOneOut').result.kind).toBe('mc');
	});

	it('falls back to mc when the three values are not distinct after normalising', () => {
		const rows: [string, string[]][] = [
			['r0', ['p', 'z']],
			['r1', ['P', 's']],
			['r2', ['t', 'u']]
		];
		const course = buildCourse([{ content: compare(['A', 'B'], rows) }, ...FILLERS]);
		expect(build(course, 1, 'cell:0:0', 'oddOneOut').result.kind).toBe('mc');
	});

	it('falls back to mc for a card that is not a compare cell', () => {
		expect(build(NET, 1, 'fwd', 'oddOneOut').result.kind).toBe('mc');
	});
});

describe('buildExercise: multiSelect', () => {
	// SPEC-GAP: no cap on the option count is stated, so every other item's value in those rows is a
	// wrong option (3 items x 3 rows = 9 options, more than MC_OPTIONS).
	it('asks which describe item c; its values in 3 rows are correct, other items in those rows wrong', () => {
		const spec = asShape(build(CMP, 1, 'cell:0:1', 'multiSelect').result, 'chooseMany');
		expect(spec.kind).toBe('multiSelect');
		expect(spec.prompt).toBe('Which of these describe UDP?');
		const right = [value(0, 1), value(1, 1), value(2, 1)];
		const wrong = [0, 1, 2].flatMap((r) => [value(r, 0), value(r, 2)]);
		expect(sorted(texts(spec.options))).toStrictEqual(sorted([...right, ...wrong]));
		expect(sorted(spec.correct.map((i) => spec.options[i]?.text ?? ''))).toStrictEqual(
			sorted(right)
		);
	});

	it('lists correct indexes ascending', () => {
		const spec = asShape(build(CMP, 1, 'cell:0:1', 'multiSelect').result, 'chooseMany');
		expect(spec.correct).toStrictEqual([...spec.correct].sort((a, b) => a - b));
	});

	it('takes the rows from r onwards, wrapping', () => {
		const spec = asShape(build(CMP, 1, 'cell:3:2', 'multiSelect').result, 'chooseMany');
		const right = [value(3, 2), value(0, 2), value(1, 2)];
		expect(sorted(spec.correct.map((i) => spec.options[i]?.text ?? ''))).toStrictEqual(
			sorted(right)
		);
	});

	it('uses fewer rows when the note has fewer than 3', () => {
		const course = buildCourse([
			{
				content: compare(
					['A', 'B'],
					[
						['r0', ['p', 'q']],
						['r1', ['s', 't']]
					]
				)
			}
		]);
		const spec = asShape(build(course, 1, 'cell:1:0', 'multiSelect').result, 'chooseMany');
		expect(sorted(texts(spec.options))).toStrictEqual(['p', 'q', 's', 't']);
		expect(sorted(spec.correct.map((i) => spec.options[i]?.text ?? ''))).toStrictEqual(['p', 's']);
	});

	it('drops duplicates after normalising, and a wrong option equal to a correct one', () => {
		const rows: [string, string[]][] = [
			['r0', ['yes', 'yes']],
			['r1', ['fast', 'slow']],
			['r2', ['Fast!', 'slow']]
		];
		const course = buildCourse([{ content: compare(['A', 'B'], rows) }]);
		const spec = asShape(build(course, 1, 'cell:0:0', 'multiSelect').result, 'chooseMany');
		expect(norm(texts(spec.options))).toStrictEqual(['fast', 'slow', 'yes']);
		expect(norm(spec.correct.map((i) => spec.options[i]?.text ?? ''))).toStrictEqual([
			'fast',
			'yes'
		]);
	});

	it('falls back to mc when no wrong option is left', () => {
		const rows: [string, string[]][] = [
			['r0', ['same', 'same']],
			['r1', ['also', 'also']]
		];
		const course = buildCourse([{ content: compare(['A', 'B'], rows) }, ...FILLERS]);
		expect(build(course, 1, 'cell:0:0', 'multiSelect').result.kind).toBe('mc');
	});

	it('falls back to mc for a card that is not a compare cell', () => {
		expect(build(NET, 1, 'fwd', 'multiSelect').result.kind).toBe('mc');
	});
});

describe('buildExercise: pickPrinciple', () => {
	const ATTRS = ['a0', 'a1', 'a2', 'a3', 'a4', 'a5'];
	const WIDE = buildCourse([
		{
			content: compare(
				['A', 'B'],
				ATTRS.map((attr, r): [string, string[]] => [attr, [`A${r}`, `B${r}`]])
			)
		}
	]);

	it('prompt lists every item value in row r; attribute r is correct', () => {
		const spec = asShape(build(WIDE, 1, 'row:4', 'pickPrinciple').result, 'choose');
		expect(spec.kind).toBe('pickPrinciple');
		expect(spec.prompt).toContain('A4');
		expect(spec.prompt).toContain('B4');
		expect(spec.options[spec.correctIndex]?.text).toBe('a4');
	});

	it('offers at most MC_OPTIONS attributes, the others in row order after r, wrapping', () => {
		const spec = asShape(build(WIDE, 1, 'row:4', 'pickPrinciple').result, 'choose');
		const expected = Array.from(
			{ length: MC_OPTIONS },
			(_, k) => ATTRS[(4 + k) % ATTRS.length] ?? ''
		);
		expect(sorted(texts(spec.options))).toStrictEqual(sorted(expected));
	});

	it('offers every attribute when the note has fewer than MC_OPTIONS rows', () => {
		const course = buildCourse([
			{
				content: compare(
					['A', 'B'],
					[
						['x', ['1', '2']],
						['y', ['3', '4']]
					]
				)
			}
		]);
		const two = asShape(build(course, 1, 'row:1', 'pickPrinciple').result, 'choose');
		expect(sorted(texts(two.options))).toStrictEqual(['x', 'y']);
		expect(two.options[two.correctIndex]?.text).toBe('y');
	});

	it('falls back to tableRow when the note has one row', () => {
		const spec = asShape(build(ALL, 6, 'row:0', 'pickPrinciple').result, 'pair');
		expect(spec.kind).toBe('tableRow');
		expect(spec.left).toStrictEqual(['TCP', 'UDP']);
	});
});

describe('buildExercise: tableRow and categorize', () => {
	it('tableRow: left = the items in order, right = row r values shuffled, pairs point right', () => {
		const spec = asShape(build(CMP, 1, 'row:1', 'tableRow').result, 'pair');
		expect(spec.kind).toBe('tableRow');
		expect(spec.prompt).toBe('Setup: match each to its value');
		expect(spec.left).toStrictEqual(CMP_ITEMS);
		expect(sorted(spec.right)).toStrictEqual(sorted(CMP_ROWS[1]?.[1] ?? []));
		CMP_ITEMS.forEach((_, i) => expect(spec.right[spec.pairs[i] ?? -1]).toBe(value(1, i)));
	});

	it('tableRow: reshuffles the right column for another attempt', () => {
		const make = (attempt: number) => build(CMP, 1, 'row:1', 'tableRow', { attempt }).result;
		expect(distinctOver(make, (s) => (s.shape === 'pair' ? s.right : null))).toBeGreaterThan(1);
	});

	const SORTABLE = buildCourse([
		{
			content: compare(
				['TCP', 'UDP'],
				[
					['Reliable', ['yes', 'no']],
					['Setup', ['handshake', 'none']],
					['Layer', ['transport', 'Transport']]
				]
			)
		}
	]);

	it('categorize: buckets = items; every value is an item with its column as bucket', () => {
		const spec = asShape(build(SORTABLE, 1, 'cell:0:0', 'categorize').result, 'sort');
		expect(spec.kind).toBe('categorize');
		expect(spec.buckets).toStrictEqual(['TCP', 'UDP']);
		expect(sorted(spec.items)).toStrictEqual(sorted(['yes', 'no', 'handshake', 'none']));
		const bucketOf: Record<string, number> = { yes: 0, handshake: 0, no: 1, none: 1 };
		spec.items.forEach((item, i) => expect(spec.bucketOf[i]).toBe(bucketOf[item]));
	});

	it('categorize: leaves out a value that appears under more than one item after normalising', () => {
		const spec = asShape(build(SORTABLE, 1, 'row:2', 'categorize').result, 'sort');
		expect(norm(spec.items)).not.toContain('transport');
	});

	it('categorize: works from any compare card (row, cell or which)', () => {
		for (const variant of ['row:0', 'cell:1:1', 'which:0']) {
			expect(build(SORTABLE, 1, variant, 'categorize').result.kind).toBe('categorize');
		}
	});

	it('categorize: reshuffles the items for another attempt', () => {
		const make = (attempt: number) => build(SORTABLE, 1, 'row:0', 'categorize', { attempt }).result;
		expect(distinctOver(make, (s) => (s.shape === 'sort' ? s.items : null))).toBeGreaterThan(1);
	});

	const SHARED = buildCourse([
		{
			content: compare(
				['A', 'B'],
				[
					['r0', ['k', 'same']],
					['r1', ['same', 'same']]
				]
			)
		}
	]);

	it('categorize falls back to tableRow on the row:r card own row when < 2 values are left', () => {
		const spec = asShape(build(SHARED, 1, 'row:1', 'categorize').result, 'pair');
		expect(spec.kind).toBe('tableRow');
		expect(spec.left).toStrictEqual(['A', 'B']);
		expect(sorted(spec.right)).toStrictEqual(['same', 'same']);
	});

	// SPEC-GAP: "the card's own row (row:r, or row 0 for other variants)" is read literally: only a
	// row:r card uses row r; cell:r:c and which:r cards use row 0.
	it('categorize falls back to tableRow on row 0 for a cell card', () => {
		const spec = asShape(build(SHARED, 1, 'cell:1:0', 'categorize').result, 'pair');
		expect(spec.kind).toBe('tableRow');
		expect(sorted(spec.right)).toStrictEqual(['k', 'same']);
		spec.left.forEach((_, i) => expect(spec.right[spec.pairs[i] ?? -1]).toBe(['k', 'same'][i]));
	});
});

describe('buildExercise: sequence and parsons', () => {
	const STEPS = ['SYN', 'SYN-ACK', 'ACK', 'DATA'];
	const inOrder = (spec: { items: string[]; correctOrder: number[] }) =>
		spec.correctOrder.map((i) => spec.items[i]);

	it('sequence: the steps shuffled; correctOrder lists them in the right order; no extras', () => {
		const spec = asShape(build(SEQ, 1, 'seq', 'sequence').result, 'order');
		expect(spec.kind).toBe('sequence');
		expect(spec.prompt).toBe('Put the steps of Handshake in order');
		expect(sorted(spec.items)).toStrictEqual(sorted(STEPS));
		expect(inOrder(spec)).toStrictEqual(STEPS);
		expect(spec.extras).toStrictEqual([]);
	});

	it('sequence: reshuffles the items for another attempt', () => {
		const make = (attempt: number) => build(SEQ, 1, 'seq', 'sequence', { attempt }).result;
		expect(distinctOver(make, (s) => (s.shape === 'order' ? s.items : null))).toBeGreaterThan(1);
	});

	it('parsons: the steps plus PARSONS_EXTRAS extras from other notes, in course card order', () => {
		const spec = asShape(build(SEQ, 1, 'seq', 'parsons').result, 'order');
		expect(spec.kind).toBe('parsons');
		expect(inOrder(spec)).toStrictEqual(STEPS);
		expect(spec.extras).toHaveLength(PARSONS_EXTRAS);
		expect(spec.items).toHaveLength(STEPS.length + PARSONS_EXTRAS);
		// Boot's "syn!" equals SYN after normalising, so its next steps are taken.
		expect(spec.extras.map((i) => spec.items[i])).toStrictEqual(
			['POST', 'Kernel'].slice(0, PARSONS_EXTRAS)
		);
	});

	it('parsons: extras and correctOrder never overlap', () => {
		const spec = asShape(build(SEQ, 1, 'seq', 'parsons').result, 'order');
		for (const extra of spec.extras) expect(spec.correctOrder).not.toContain(extra);
	});

	it('parsons: takes extras from example notes too, following the course card order', () => {
		const cards = [...SEQ.cards].sort((a, b) =>
			a.noteId === b.noteId ? 0 : a.noteId > b.noteId ? -1 : 1
		);
		const spec = asShape(build(SEQ, 1, 'seq', 'parsons', { cards }).result, 'order');
		const exampleSteps = SOLVE_STEPS.map(([, step]) => step);
		expect(spec.extras.map((i) => spec.items[i])).toStrictEqual(
			exampleSteps.slice(0, PARSONS_EXTRAS)
		);
	});

	it('parsons on ex: the example steps plus extras from the course sequences', () => {
		const spec = asShape(build(SEQ, 3, 'ex', 'parsons').result, 'order');
		expect(spec.kind).toBe('parsons');
		expect(inOrder(spec)).toStrictEqual(SOLVE_STEPS.map(([, step]) => step));
		expect(spec.extras.map((i) => spec.items[i])).toStrictEqual(STEPS.slice(0, PARSONS_EXTRAS));
	});

	it('parsons: takes fewer extras when fewer are available', () => {
		const course = buildCourse([
			{ content: sequence('Handshake', STEPS) },
			{ content: sequence('Other', ['syn', 'Only new']) }
		]);
		const spec = asShape(build(course, 1, 'seq', 'parsons').result, 'order');
		expect(spec.extras.map((i) => spec.items[i])).toStrictEqual(['Only new']);
	});

	it('parsons falls back to sequence when no extra is available', () => {
		const course = buildCourse([
			{ content: sequence('Handshake', STEPS) },
			{ content: sequence('Dup', ['syn.', 'ACK']) }
		]);
		const spec = asShape(build(course, 1, 'seq', 'parsons').result, 'order');
		expect(spec.kind).toBe('sequence');
		expect(spec.extras).toStrictEqual([]);
		expect(inOrder(spec)).toStrictEqual(STEPS);
	});
});

describe('buildExercise: worked examples', () => {
	const SUBGOALS = SOLVE_STEPS.map(([subgoal]) => subgoal);
	const STEPS = SOLVE_STEPS.map(([, step]) => step);
	/** Path: exampleStudy(0) fadeStep(1) fadeStep(2) fadeStep(3) newInstance(4) subgoalMatch(5). */
	const fade = (step: number) => asShape(build(SEQ, 3, 'ex', 'fadeStep', { step }).result, 'type');

	it('exampleStudy: every step with its subgoal, in order', () => {
		const spec = asShape(build(SEQ, 3, 'ex', 'exampleStudy').result, 'study');
		expect(spec.kind).toBe('exampleStudy');
		expect(spec.steps).toStrictEqual(SOLVE_STEPS.map(([subgoal, step]) => ({ subgoal, step })));
	});

	it('subgoalMatch: left = the steps, right = the subgoals shuffled, pairs point right', () => {
		const spec = asShape(build(SEQ, 3, 'ex', 'subgoalMatch').result, 'pair');
		expect(spec.left).toStrictEqual(STEPS);
		expect(sorted(spec.right)).toStrictEqual(sorted(SUBGOALS));
		STEPS.forEach((_, i) => expect(spec.right[spec.pairs[i] ?? -1]).toBe(SUBGOALS[i]));
	});

	it('fadeStep k=1 (first fadeStep in the path): context steps 0…n−2, asks for the last step', () => {
		const spec = fade(1);
		expect(spec.kind).toBe('fadeStep');
		expect(spec.answer).toBe(STEPS[2]);
		expect(spec.prompt).toContain(SUBGOALS[2]);
		expect(spec.context).toHaveLength(2);
		[0, 1].forEach((i) => {
			expect(spec.context[i]).toContain(STEPS[i]);
			expect(spec.context[i]).toContain(SUBGOALS[i]);
		});
	});

	it('fadeStep k=2: context step 0 only, asks for step 1, later steps hidden', () => {
		const spec = fade(2);
		expect(spec.answer).toBe(STEPS[1]);
		expect(spec.prompt).toContain(SUBGOALS[1]);
		expect(spec.context).toHaveLength(1);
		const shown = [spec.prompt, ...spec.context].join('\n');
		expect(shown).not.toContain(STEPS[1]);
		expect(shown).not.toContain(STEPS[2]);
	});

	it('fadeStep k=n: no context, asks for step 0', () => {
		const spec = fade(3);
		expect(spec.answer).toBe(STEPS[0]);
		expect(spec.prompt).toContain(SUBGOALS[0]);
		expect(spec.context).toStrictEqual([]);
	});

	it('fadeStep: others are the note other steps; no letter', () => {
		const spec = fade(2);
		expect(sorted(spec.others.map((o) => o.text))).toStrictEqual(
			sorted([STEPS[0] ?? '', STEPS[2] ?? ''])
		);
		expect(spec.letter).toBeNull();
	});

	it('newInstance: asks for the step of one subgoal; answer = that step, others = the rest', () => {
		for (const attempt of [0, 1, 2, 3, 4]) {
			const spec = asShape(build(SEQ, 3, 'ex', 'newInstance', { attempt }).result, 'type');
			expect(spec.kind).toBe('newInstance');
			const shown = SUBGOALS.filter((subgoal) => spec.prompt.includes(subgoal));
			expect(shown).toHaveLength(1);
			const i = SUBGOALS.indexOf(shown[0] ?? '');
			expect(spec.answer).toBe(STEPS[i]);
			expect(sorted(spec.others.map((o) => o.text))).toStrictEqual(
				sorted(STEPS.filter((_, j) => j !== i))
			);
		}
	});

	it('newInstance: the subgoal is chosen by the seeded rng and varies by attempt', () => {
		const make = (attempt: number) => build(SEQ, 3, 'ex', 'newInstance', { attempt }).result;
		expect(distinctOver(make, (s) => (s.shape === 'type' ? s.answer : null))).toBeGreaterThan(1);
	});
});

describe('buildExercise: matching', () => {
	const MATCH = buildCourse([
		{ content: keyterm('TCP', 'reliable stream'), order: 2 },
		{ content: keyterm('UDP', 'datagrams'), order: 0 },
		{ content: fact('IP', 'routes packets'), order: 1 },
		{ content: keyterm('DNS', 'names'), order: 3 },
		{ content: keyterm('ARP', 'addresses'), order: 4 },
		{ content: keyterm('SMTP', 'mail'), topic: 2, order: 0 }
	]);
	const MEANING: Record<string, string> = {
		TCP: 'reliable stream',
		UDP: 'datagrams',
		IP: 'routes packets',
		DNS: 'names',
		ARP: 'addresses',
		SMTP: 'mail',
		POP: 'fetch mail',
		IMAP: 'sync mail'
	};
	const expectPairs = (spec: { left: string[]; right: string[]; pairs: number[] }) =>
		spec.left.forEach((term, i) => expect(spec.right[spec.pairs[i] ?? -1]).toBe(MEANING[term]));

	it('own pair first, then other keyterm/fact notes of the topic in note order', () => {
		const spec = asShape(build(MATCH, 1, 'fwd', 'matching').result, 'pair');
		expect(spec.kind).toBe('matching');
		expect(spec.left).toStrictEqual([
			'TCP',
			...['UDP', 'IP', 'DNS', 'ARP'].slice(0, MATCHING_PAIRS - 1)
		]);
		expect(spec.left).toHaveLength(MATCHING_PAIRS);
		expectPairs(spec);
	});

	// SPEC-GAP: with several other topics, is "the course" taken in topic order then note order? Only
	// one other topic is used here.
	it('fills from the rest of the course, in note order, after the topic', () => {
		const course = buildCourse([
			{ content: keyterm('TCP', MEANING.TCP ?? ''), order: 0 },
			{ content: keyterm('UDP', MEANING.UDP ?? ''), order: 1 },
			{ content: keyterm('SMTP', MEANING.SMTP ?? ''), topic: 2, order: 1 },
			{ content: keyterm('POP', MEANING.POP ?? ''), topic: 2, order: 0 },
			{ content: keyterm('IMAP', MEANING.IMAP ?? ''), topic: 2, order: 2 }
		]);
		const spec = asShape(build(course, 1, 'fwd', 'matching').result, 'pair');
		expect(spec.left).toStrictEqual(['TCP', 'UDP', 'POP', 'SMTP', 'IMAP'].slice(0, MATCHING_PAIRS));
		expectPairs(spec);
	});

	it('a fact card pairs its term with its definition', () => {
		const spec = asShape(build(MATCH, 3, 'fwd', 'matching').result, 'pair');
		expect(spec.left[0]).toBe('IP');
		expectPairs(spec);
	});

	it('reshuffles the right column for another attempt', () => {
		const make = (attempt: number) => build(MATCH, 1, 'fwd', 'matching', { attempt }).result;
		expect(distinctOver(make, (s) => (s.shape === 'pair' ? s.right : null))).toBeGreaterThan(1);
	});

	it('falls back to mc when there is no other pair', () => {
		const course = buildCourse([
			{ content: keyterm('TCP', 'stream') },
			{ content: cloze('{{UDP}} and {{DNS}} and {{ARP}}') }
		]);
		expect(build(course, 1, 'fwd', 'matching').result.kind).toBe('mc');
	});
});

describe('buildExercise: flip, explainIt, blurt', () => {
	const lines = (answer: string) => answer.split('\n');
	const ordered = (answer: string, parts: readonly string[]) => {
		const at = parts.map((part) => answer.indexOf(part));
		expect(at.every((i) => i >= 0)).toBe(true);
		expect(at).toStrictEqual([...at].sort((a, b) => a - b));
	};

	it('flip: the text answer of the card', () => {
		expect(asShape(build(ALL, 1, 'fwd', 'flip').result, 'selfRate').answer).toBe('TCP');
		expect(asShape(build(ALL, 3, 'c2', 'flip').result, 'selfRate').answer).toBe('instructions');
	});

	// SPEC-GAP: "the steps joined in order" doesn't name the separator; only the order is checked.
	it('flip on seq: the steps joined in order', () => {
		ordered(asShape(build(ALL, 4, 'seq', 'flip').result, 'selfRate').answer, [
			'SYN',
			'SYN-ACK',
			'ACK',
			'DATA'
		]);
	});

	it('flip on ex: the steps joined in order', () => {
		ordered(
			asShape(build(ALL, 5, 'ex', 'flip').result, 'selfRate').answer,
			SOLVE_STEPS.map(([, step]) => step)
		);
	});

	// SPEC-GAP: "one line per item" read as lines joined with "\n".
	it('flip on row:r: one "<item>: <value>" line per item', () => {
		const spec = asShape(build(CMP, 1, 'row:1', 'flip').result, 'selfRate');
		expect(lines(spec.answer)).toStrictEqual(CMP_ITEMS.map((item, c) => `${item}: ${value(1, c)}`));
	});

	it('explainIt: every span blanked in the prompt, the spans as the checklist', () => {
		const spec = asShape(build(ALL, 3, 'c1', 'explainIt').result, 'selfRate');
		expect(spec.kind).toBe('explainIt');
		expect(spec.prompt).toBe('The _____ runs _____ from _____.');
		expect(texts(spec.checklist)).toStrictEqual(['CPU', 'instructions', 'memory']);
	});

	it('explainIt falls back to flip for a note that is not a cloze', () => {
		const spec = asShape(build(ALL, 1, 'fwd', 'explainIt').result, 'selfRate');
		expect(spec.kind).toBe('flip');
		expect(spec.answer).toBe('TCP');
	});

	const blurt = (course: TestCourse, n: number, variant: string) =>
		asShape(build(course, n, variant, 'blurt').result, 'selfRate');
	const byCard = (items: readonly { text: string; cardId?: string }[]) =>
		[...items].sort((a, b) => ((a.cardId ?? '') < (b.cardId ?? '') ? -1 : 1));

	it('blurt: titles by term, name or situation', () => {
		expect(blurt(ALL, 1, 'fwd').prompt).toBe('Recall everything you can about TCP');
		expect(blurt(ALL, 2, 'rev').prompt).toBe('Recall everything you can about IP');
		expect(blurt(ALL, 4, 'step:0').prompt).toBe('Recall everything you can about Handshake');
		expect(blurt(ALL, 7, 'fwd').prompt).toBe('Recall everything you can about Live video call');
	});

	it('blurt: a cloze note is titled by its first BLURT_TITLE_CHARS characters', () => {
		expect(blurt(ALL, 8, 'c1').prompt).toBe(
			`Recall everything you can about ${LONG_CLOZE.slice(0, BLURT_TITLE_CHARS)}`
		);
	});

	// SPEC-GAP: the checklist order isn't stated; compared sorted by card ID.
	it('blurt: the checklist is the text answers of the note cards, with their card IDs', () => {
		expect(byCard(blurt(ALL, 4, 'seq').checklist)).toStrictEqual([
			{ text: 'SYN-ACK', cardId: cardIdOf(4, 1) },
			{ text: 'ACK', cardId: cardIdOf(4, 2) },
			{ text: 'DATA', cardId: cardIdOf(4, 3) }
		]);
		expect(byCard(blurt(ALL, 2, 'fwd').checklist)).toStrictEqual([
			{ text: 'routes packets between hosts', cardId: cardIdOf(2, 0) },
			{ text: 'IP', cardId: cardIdOf(2, 1) }
		]);
		expect(byCard(blurt(ALL, 7, 'fwd').checklist)).toStrictEqual([
			{ text: 'UDP', cardId: cardIdOf(7, 0) }
		]);
	});

	it('blurt falls back to flip when the checklist is empty', () => {
		const spec = asShape(build(ALL, 5, 'ex', 'blurt').result, 'selfRate');
		expect(spec.kind).toBe('flip');
	});
});
