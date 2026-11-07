import { describe, expect, it } from 'vitest';
import { checkResponse, type ExerciseResponse } from '#lib/engine/exercise-check.ts';
import type {
	ChooseManySpec,
	ChooseSpec,
	ExerciseSpec,
	OrderSpec,
	PairSpec,
	SelfRateSpec,
	SortSpec,
	StudySpec,
	TypeSpec
} from '#lib/engine/exercise-spec.ts';
import { cardId } from './fixtures.ts';

const OWN = cardId(1);
const OTHER = cardId(2);
const THIRD = cardId(3);
const normalize = (text: string): string => text.trim().toLowerCase();
const asc = (values: readonly number[]): number[] => [...values].sort((a, b) => a - b);

// Specs are written by hand, so these tests don't depend on buildExercise.

const TYPE: TypeSpec = {
	shape: 'type',
	kind: 'cloze',
	cardId: OWN,
	prompt: 'reliable byte stream',
	instruction: 'Type the term',
	answer: 'TCP',
	accepted: ['Transmission Control Protocol'],
	others: [
		{ cardId: OTHER, text: 'UDP' },
		{ cardId: THIRD, text: 'Address Resolution Protocol' }
	],
	letter: null,
	context: []
};

const CHOOSE: ChooseSpec = {
	shape: 'choose',
	kind: 'mc',
	cardId: OWN,
	prompt: 'reliable byte stream',
	instruction: 'Pick the term',
	options: [
		{ text: 'UDP', cardId: OTHER, answers: 'connectionless datagrams' },
		{ text: 'TCP', cardId: OWN },
		{ text: 'DNS', cardId: THIRD, answers: 'name resolution' }
	],
	correctIndex: 1,
	letter: null
};

/** A which:r spec: the options are the note's items, with no card behind them. */
const CHOOSE_ITEMS: ChooseSpec = {
	...CHOOSE,
	kind: 'whichOne',
	prompt: 'Which one has Setup: none?',
	options: [{ text: 'TCP' }, { text: 'UDP' }, { text: 'QUIC' }],
	correctIndex: 1
};

const MANY: ChooseManySpec = {
	shape: 'chooseMany',
	kind: 'multiSelect',
	cardId: OWN,
	prompt: 'Which of these describe UDP?',
	instruction: 'Pick every one that applies',
	options: [{ text: 'none' }, { text: 'handshake' }, { text: 'best effort' }, { text: '20 bytes' }],
	correct: [0, 2]
};

/** Items shown C, A, D, B; the right order is A B C D. */
const ORDER: OrderSpec = {
	shape: 'order',
	kind: 'sequence',
	cardId: OWN,
	prompt: 'Put the steps of Letters in order',
	instruction: 'Put them in order',
	items: ['C', 'A', 'D', 'B'],
	correctOrder: [1, 3, 0, 2],
	extras: []
};

/** As ORDER plus two extras at item indexes 4 and 5. */
const PARSONS: OrderSpec = {
	...ORDER,
	kind: 'parsons',
	items: ['C', 'A', 'D', 'B', 'X', 'Y'],
	extras: [4, 5]
};

const PAIR: PairSpec = {
	shape: 'pair',
	kind: 'tableRow',
	cardId: OWN,
	prompt: 'Setup: match each to its value',
	instruction: 'Match each',
	left: ['TCP', 'UDP', 'QUIC'],
	right: ['none', '0-RTT', 'handshake'],
	pairs: [2, 0, 1]
};

const SORT: SortSpec = {
	shape: 'sort',
	kind: 'categorize',
	cardId: OWN,
	prompt: 'Sort these',
	instruction: 'Sort each into its group',
	buckets: ['TCP', 'UDP'],
	items: ['none', 'handshake', 'best effort', 'guaranteed'],
	bucketOf: [1, 0, 1, 0]
};

const SELF: SelfRateSpec = {
	shape: 'selfRate',
	kind: 'flip',
	cardId: OWN,
	prompt: 'reliable byte stream',
	instruction: 'Recall it, then flip',
	answer: 'TCP',
	checklist: []
};

const BLURT: SelfRateSpec = {
	...SELF,
	kind: 'blurt',
	prompt: 'Recall everything you can about Handshake',
	checklist: [
		{ text: 'SYN-ACK', cardId: OTHER },
		{ text: 'ACK', cardId: THIRD }
	]
};

const STUDY: StudySpec = {
	shape: 'study',
	kind: 'exampleStudy',
	cardId: OWN,
	prompt: 'Solve',
	instruction: 'Study each step',
	steps: [
		{ subgoal: 'isolate x', step: 'x = 4' },
		{ subgoal: 'check', step: 'x + 1 = 5' }
	]
};

const check = (spec: ExerciseSpec, response: ExerciseResponse) =>
	checkResponse(spec, response).result;

describe('checkResponse: type', () => {
	it('is correct for the exact answer; reveal is the answer; chosen is the normalised text', () => {
		const verdict = check(TYPE, { shape: 'type', typed: '  TCP  ' });
		expect(verdict.correct).toBe(true);
		expect(verdict.reveal).toStrictEqual(['TCP']);
		expect(verdict.chosen).toBe('tcp');
		expect(verdict.marks).toStrictEqual([]);
		expect(verdict.chosenFromCardId).toBeUndefined();
		expect(verdict.contrast).toBeUndefined();
	});

	it('is correct for an accepted string', () => {
		expect(check(TYPE, { shape: 'type', typed: 'transmission control protocol' }).correct).toBe(
			true
		);
	});

	it('is correct within the fuzzy tolerance (gradeTyped)', () => {
		const spec: TypeSpec = { ...TYPE, answer: 'Transmission Control', accepted: [] };
		expect(check(spec, { shape: 'type', typed: 'Transmision Control' }).correct).toBe(true);
	});

	// SPEC-GAP: a type spec has one part, so "marks" has nothing to list; read as empty when wrong.
	it('is wrong for another string; reveal still shows the answer', () => {
		const verdict = check(TYPE, { shape: 'type', typed: 'SCTP' });
		expect(verdict.correct).toBe(false);
		expect(verdict.reveal).toStrictEqual(['TCP']);
		expect(verdict.chosen).toBe('sctp');
		expect(verdict.marks).toStrictEqual([]);
		expect(verdict.chosenFromCardId).toBeUndefined();
	});

	// SPEC-GAP: §5.1 says a typed collision also sets `contrast` { chosen, answers }, but a type spec's
	// `others` carry no prompt of the other card, so `answers` can't be filled from the spec alone.
	// Only `chosenFromCardId` is required here; if `contrast` is set, its `chosen` is the typed text.
	it('is wrong on a collision with another card answer, naming that card', () => {
		const verdict = check(TYPE, { shape: 'type', typed: 'udp' });
		expect(verdict.correct).toBe(false);
		expect(verdict.chosenFromCardId).toBe(OTHER);
		if (verdict.contrast) expect(normalize(verdict.contrast.chosen)).toBe('udp');
	});

	it('rejects a fuzzy near-miss of the answer that exactly matches another card (collision guard)', () => {
		const others = [{ cardId: OTHER, text: 'Address Revolution' }];
		const spec: TypeSpec = { ...TYPE, answer: 'Address Resolution', accepted: [], others };
		const verdict = check(spec, { shape: 'type', typed: 'address revolution' });
		expect(verdict.correct).toBe(false);
		expect(verdict.chosenFromCardId).toBe(OTHER);
	});
});

describe('checkResponse: choose', () => {
	it('is correct when index === correctIndex, with no contrast', () => {
		const verdict = check(CHOOSE, { shape: 'choose', index: 1 });
		expect(verdict.correct).toBe(true);
		expect(verdict.reveal).toStrictEqual(['TCP']);
		expect(verdict.chosen).toBe('TCP');
		expect(verdict.marks).toStrictEqual([]);
		expect(verdict.chosenFromCardId).toBeUndefined();
		expect(verdict.contrast).toBeUndefined();
	});

	it('a wrong pick that is another card answer sets chosenFromCardId and contrast', () => {
		const verdict = check(CHOOSE, { shape: 'choose', index: 2 });
		expect(verdict.correct).toBe(false);
		expect(verdict.reveal).toStrictEqual(['TCP']);
		expect(verdict.chosen).toBe('DNS');
		expect(verdict.chosenFromCardId).toBe(THIRD);
		expect(verdict.contrast).toStrictEqual({ chosen: 'DNS', answers: 'name resolution' });
		expect(verdict.marks).toStrictEqual([2]);
	});

	it('a wrong pick with no card behind it has no contrast', () => {
		const verdict = check(CHOOSE_ITEMS, { shape: 'choose', index: 0 });
		expect(verdict.correct).toBe(false);
		expect(verdict.reveal).toStrictEqual(['UDP']);
		expect(verdict.chosen).toBe('TCP');
		expect(verdict.chosenFromCardId).toBeUndefined();
		expect(verdict.contrast).toBeUndefined();
		expect(verdict.marks).toStrictEqual([0]);
	});

	it('the first-letter bank grades the same way', () => {
		const bank: ChooseSpec = { ...CHOOSE, kind: 'firstLetterBank', letter: 't' };
		expect(check(bank, { shape: 'choose', index: 1 }).correct).toBe(true);
		expect(check(bank, { shape: 'choose', index: 0 }).chosenFromCardId).toBe(OTHER);
	});
});

describe('checkResponse: chooseMany', () => {
	it('is correct when the chosen set equals correct, in any order', () => {
		const verdict = check(MANY, { shape: 'chooseMany', indexes: [2, 0] });
		expect(verdict.correct).toBe(true);
		expect(verdict.marks).toStrictEqual([]);
	});

	it('reveal is one line per correct option', () => {
		const verdict = check(MANY, { shape: 'chooseMany', indexes: [0, 2] });
		expect(verdict.reveal).toStrictEqual(['none', 'best effort']);
	});

	it('chosen carries the text of every chosen option', () => {
		const verdict = check(MANY, { shape: 'chooseMany', indexes: [0, 1] });
		expect(verdict.chosen).toContain('none');
		expect(verdict.chosen).toContain('handshake');
	});

	// SPEC-GAP: "wrong option indexes" for a multi-select is read as both kinds of mistake: options
	// picked but not correct, and correct options left unpicked. Order is not asserted.
	it('is wrong with a missing option; marks the missed option', () => {
		const verdict = check(MANY, { shape: 'chooseMany', indexes: [0] });
		expect(verdict.correct).toBe(false);
		expect(asc(verdict.marks)).toStrictEqual([2]);
	});

	it('is wrong with an extra option; marks the extra option', () => {
		const verdict = check(MANY, { shape: 'chooseMany', indexes: [0, 2, 3] });
		expect(verdict.correct).toBe(false);
		expect(asc(verdict.marks)).toStrictEqual([3]);
	});

	it('marks both missed and extra options together', () => {
		const verdict = check(MANY, { shape: 'chooseMany', indexes: [1, 2] });
		expect(asc(verdict.marks)).toStrictEqual([0, 1]);
	});

	it('is wrong with nothing chosen', () => {
		expect(check(MANY, { shape: 'chooseMany', indexes: [] }).correct).toBe(false);
	});
});

describe('checkResponse: order', () => {
	it('is correct when order equals correctOrder exactly', () => {
		const verdict = check(ORDER, { shape: 'order', order: [1, 3, 0, 2] });
		expect(verdict.correct).toBe(true);
		expect(verdict.marks).toStrictEqual([]);
	});

	it('reveal is one line per step, in the right order', () => {
		expect(check(ORDER, { shape: 'order', order: [1, 3, 0, 2] }).reveal).toStrictEqual([
			'A',
			'B',
			'C',
			'D'
		]);
	});

	it('marks the misplaced item indexes by the longest increasing subsequence', () => {
		// Placed B C D A → steps 1 2 3 0; the LIS keeps B C D, so A (item 1) is misplaced.
		const verdict = check(ORDER, { shape: 'order', order: [3, 0, 2, 1] });
		expect(verdict.correct).toBe(false);
		expect(verdict.marks).toStrictEqual([1]);
	});

	it('parsons: correct when the extras are left out', () => {
		expect(check(PARSONS, { shape: 'order', order: [1, 3, 0, 2] }).correct).toBe(true);
	});

	it('parsons: placing an extra is wrong and marks the extra', () => {
		const verdict = check(PARSONS, { shape: 'order', order: [1, 3, 0, 2, 4] });
		expect(verdict.correct).toBe(false);
		expect(verdict.marks).toStrictEqual([4]);
	});

	it('parsons: an extra placed in the middle is marked, the real steps in order are not', () => {
		const verdict = check(PARSONS, { shape: 'order', order: [1, 5, 3, 0, 2] });
		expect(verdict.correct).toBe(false);
		expect(asc(verdict.marks)).toStrictEqual([5]);
	});

	it('parsons: misplaced steps and placed extras are both marked', () => {
		const verdict = check(PARSONS, { shape: 'order', order: [3, 0, 2, 1, 4] });
		expect(asc(verdict.marks)).toStrictEqual([1, 4]);
	});

	it('is wrong (and does not throw) when a real step is left out', () => {
		expect(check(ORDER, { shape: 'order', order: [1, 3, 0] }).correct).toBe(false);
	});
});

describe('checkResponse: pair', () => {
	it('is correct when every match equals pairs', () => {
		const verdict = check(PAIR, { shape: 'pair', matches: [2, 0, 1] });
		expect(verdict.correct).toBe(true);
		expect(verdict.marks).toStrictEqual([]);
	});

	it('marks the wrong left indexes', () => {
		const verdict = check(PAIR, { shape: 'pair', matches: [0, 2, 1] });
		expect(verdict.correct).toBe(false);
		expect(asc(verdict.marks)).toStrictEqual([0, 1]);
	});

	it('treats −1 (no match) as wrong and marks it', () => {
		const verdict = check(PAIR, { shape: 'pair', matches: [2, -1, 1] });
		expect(verdict.correct).toBe(false);
		expect(verdict.marks).toStrictEqual([1]);
	});

	it('reveal has one line per left entry naming its right entry', () => {
		const { reveal } = check(PAIR, { shape: 'pair', matches: [2, 0, 1] });
		expect(reveal).toHaveLength(PAIR.left.length);
		PAIR.left.forEach((left, i) => {
			expect(reveal[i]).toContain(left);
			expect(reveal[i]).toContain(PAIR.right[PAIR.pairs[i] ?? -1]);
		});
	});
});

describe('checkResponse: sort', () => {
	it('is correct when every placement equals bucketOf', () => {
		const verdict = check(SORT, { shape: 'sort', placed: [1, 0, 1, 0] });
		expect(verdict.correct).toBe(true);
		expect(verdict.marks).toStrictEqual([]);
	});

	it('marks the wrong item indexes', () => {
		const verdict = check(SORT, { shape: 'sort', placed: [0, 0, 1, 1] });
		expect(verdict.correct).toBe(false);
		expect(asc(verdict.marks)).toStrictEqual([0, 3]);
	});

	it('treats −1 (not placed) as wrong and marks it', () => {
		const verdict = check(SORT, { shape: 'sort', placed: [1, -1, 1, 0] });
		expect(verdict.correct).toBe(false);
		expect(verdict.marks).toStrictEqual([1]);
	});

	// SPEC-GAP: the reveal lines of a sort aren't specified (per item or per bucket); only that every
	// item appears in them is checked.
	it('reveal mentions every item', () => {
		const text = check(SORT, { shape: 'sort', placed: [0, 0, 0, 0] }).reveal.join('\n');
		for (const item of SORT.items) expect(text).toContain(item);
	});
});

describe('checkResponse: self-rated and study', () => {
	it('flip is never graded: correct whatever the rating', () => {
		for (const rating of ['again', 'hard', 'good'] as const) {
			const verdict = check(SELF, { shape: 'selfRate', rating, checked: [] });
			expect(verdict.correct).toBe(true);
			expect(verdict.marks).toStrictEqual([]);
		}
	});

	it('blurt is never graded: correct with nothing checked', () => {
		expect(check(BLURT, { shape: 'selfRate', checked: [] }).correct).toBe(true);
		expect(check(BLURT, { shape: 'selfRate', checked: [0, 1] }).correct).toBe(true);
	});

	it('exampleStudy is never graded: correct', () => {
		const verdict = check(STUDY, { shape: 'study' });
		expect(verdict.correct).toBe(true);
		expect(verdict.marks).toStrictEqual([]);
	});
});

describe('checkResponse: contract', () => {
	const mismatches: [string, ExerciseSpec, ExerciseResponse][] = [
		['type spec, choose response', TYPE, { shape: 'choose', index: 0 }],
		['choose spec, type response', CHOOSE, { shape: 'type', typed: 'TCP' }],
		['chooseMany spec, choose response', MANY, { shape: 'choose', index: 0 }],
		['order spec, pair response', ORDER, { shape: 'pair', matches: [0, 1, 2, 3] }],
		['pair spec, sort response', PAIR, { shape: 'sort', placed: [0, 1, 2] }],
		['sort spec, order response', SORT, { shape: 'order', order: [0, 1, 2, 3] }],
		['selfRate spec, study response', SELF, { shape: 'study' }],
		['study spec, selfRate response', STUDY, { shape: 'selfRate', checked: [] }]
	];

	it.each(mismatches)(
		'throws when the response shape differs from the spec: %s',
		(_, spec, response) => {
			expect(() => checkResponse(spec, response)).toThrow();
		}
	);

	it('is deterministic: the same spec and response give the same verdict and trace', () => {
		const response: ExerciseResponse = { shape: 'choose', index: 2 };
		expect(checkResponse(CHOOSE, response)).toStrictEqual(checkResponse(CHOOSE, response));
	});
});
