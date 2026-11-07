import { describe, expect, it } from 'vitest';
import { checkAccept, gradeTyped, type OtherAnswer, type TypedInput } from '#lib/engine/grading.ts';
import { cardId } from './fixtures.ts';

const SELF = cardId(1);
const OTHER = cardId(2);
const THIRD = cardId(3);

const grade = (overrides: Partial<TypedInput> & Pick<TypedInput, 'typed' | 'answer'>) =>
	gradeTyped({ cardId: SELF, accepted: [], others: [], ...overrides }).result;

/** @see BUILD_PLAN §6.10 and Decisions log (typed grading order) */
describe('gradeTyped: exact and normalised matches', () => {
	it('accepts an exact match as correct with 0 edits', () => {
		expect(grade({ typed: 'TCP', answer: 'TCP' })).toMatchObject({
			correct: true,
			match: 'exact',
			edits: 0,
			normalized: 'tcp'
		});
	});

	it('compares after normalising both sides', () => {
		const verdict = grade({ typed: '  the   STACK! ', answer: 'The stack' });
		expect(verdict).toMatchObject({ correct: true, match: 'exact', normalized: 'the stack' });
	});

	it('returns the normalised typed text as `normalized` (logged in `chosen`)', () => {
		expect(grade({ typed: '  Heap,  ', answer: 'stack' }).normalized).toBe('heap');
	});

	it('marks a non-matching answer wrong, match none, edits null, no confusion card', () => {
		const verdict = grade({ typed: 'queue', answer: 'stack' });
		expect(verdict.correct).toBe(false);
		expect(verdict.match).toBe('none');
		expect(verdict.edits).toBeNull();
		expect(verdict.chosenFromCardId).toBeUndefined();
	});

	it('marks a blank answer wrong', () => {
		expect(grade({ typed: '   ', answer: 'stack' }).correct).toBe(false);
	});
});

/** @see BUILD_PLAN §6.10 (fuzzy match) — boundaries at 4/5 and 8/9 chars */
describe('gradeTyped: fuzzy thresholds', () => {
	it('allows no edit for a 4-char answer', () => {
		expect(grade({ typed: 'heal', answer: 'heap' })).toMatchObject({
			correct: false,
			match: 'none'
		});
	});

	it('allows one edit for a 5-char answer', () => {
		expect(grade({ typed: 'stick', answer: 'stack' })).toMatchObject({
			correct: true,
			match: 'fuzzy',
			edits: 1
		});
	});

	it('rejects two edits for a 5-char answer', () => {
		expect(grade({ typed: 'staff', answer: 'stack' }).correct).toBe(false);
	});

	it('allows one edit for an 8-char answer', () => {
		expect(grade({ typed: 'compilar', answer: 'compiler' })).toMatchObject({
			correct: true,
			match: 'fuzzy',
			edits: 1
		});
	});

	it('rejects two edits for an 8-char answer', () => {
		expect(grade({ typed: 'kompilar', answer: 'compiler' }).correct).toBe(false);
	});

	it('allows two edits for a 9-char answer', () => {
		expect(grade({ typed: 'rekurzion', answer: 'recursion' })).toMatchObject({
			correct: true,
			match: 'fuzzy',
			edits: 2
		});
	});

	it('rejects three edits for a 9-char answer', () => {
		expect(grade({ typed: 'rekurzian', answer: 'recursion' }).correct).toBe(false);
	});

	it('takes the tolerance from the answer length, not the typed length', () => {
		// "heaps" is 5 chars, but the answer "heap" is 4 → exact only.
		expect(grade({ typed: 'heaps', answer: 'heap' }).correct).toBe(false);
	});

	it('counts a transposition as one edit', () => {
		expect(grade({ typed: 'stakc', answer: 'stack' })).toMatchObject({
			correct: true,
			match: 'fuzzy',
			edits: 1
		});
	});

	it('counts two transpositions as two edits on a 9-char answer', () => {
		expect(grade({ typed: 'ercrusion', answer: 'recursion' })).toMatchObject({
			correct: true,
			match: 'fuzzy',
			edits: 2
		});
	});
});

/** @see BUILD_PLAN §6.10 (collision guard) */
describe('gradeTyped: collision guard', () => {
	it('never accepts another card’s exact answer (TCP / UDP)', () => {
		const verdict = grade({
			typed: 'UDP',
			answer: 'TCP',
			others: [{ cardId: OTHER, text: 'UDP' }]
		});
		expect(verdict).toMatchObject({
			correct: false,
			match: 'collision',
			chosenFromCardId: OTHER
		});
	});

	it('rejects a fuzzy near-miss that exactly equals another card’s answer', () => {
		// "decryption" is 2 edits from "encryption" (10 chars → 2 allowed) but is another card’s answer.
		const verdict = grade({
			typed: 'Decryption!',
			answer: 'Encryption',
			others: [
				{ cardId: THIRD, text: 'Hashing' },
				{ cardId: OTHER, text: 'decryption' }
			]
		});
		expect(verdict).toMatchObject({
			correct: false,
			match: 'collision',
			chosenFromCardId: OTHER
		});
	});

	it('still accepts the same near-miss as fuzzy when no card has it as its answer', () => {
		expect(
			grade({
				typed: 'decryption',
				answer: 'Encryption',
				others: [{ cardId: THIRD, text: 'Hashing' }]
			})
		).toMatchObject({ correct: true, match: 'fuzzy', edits: 2 });
	});

	it('ignores the card itself when it appears in `others`', () => {
		const verdict = grade({
			typed: 'tcp',
			answer: 'TCP',
			others: [
				{ cardId: SELF, text: 'TCP' },
				{ cardId: OTHER, text: 'UDP' }
			]
		});
		expect(verdict).toMatchObject({ correct: true, match: 'exact' });
		expect(verdict.chosenFromCardId).toBeUndefined();
	});

	it('accepts an exact match with the answer even if another card has the same answer', () => {
		// Decisions log: exact match with the answer is checked before the guard.
		const verdict = grade({
			typed: 'TCP',
			answer: 'TCP',
			others: [{ cardId: OTHER, text: 'tcp' }]
		});
		expect(verdict).toMatchObject({ correct: true, match: 'exact' });
	});
});

/** @see BUILD_PLAN §6.10 (accept list) and Decisions log (accepted strings under the guard) */
describe('gradeTyped: accepted strings', () => {
	const accepted = ['Transmission Control Protocol'];

	it('accepts an exact match with an accepted string', () => {
		expect(
			grade({ typed: 'transmission control protocol', answer: 'TCP', accepted })
		).toMatchObject({ correct: true, match: 'accepted', edits: 0 });
	});

	it('fuzzy-matches an accepted string with tolerance by that string’s length', () => {
		// The answer "TCP" allows 0 edits; the accepted string (29 chars) allows 2.
		expect(grade({ typed: 'transmision control protocl', answer: 'TCP', accepted })).toMatchObject({
			correct: true,
			match: 'fuzzy',
			edits: 2
		});
	});

	it('does not accept an accepted string that is another card’s answer', () => {
		const verdict = grade({
			typed: 'udp',
			answer: 'TCP',
			accepted: ['UDP'],
			others: [{ cardId: OTHER, text: 'UDP' }]
		});
		expect(verdict).toMatchObject({
			correct: false,
			match: 'collision',
			chosenFromCardId: OTHER
		});
	});

	it('does not fuzzy-match a colliding accepted string', () => {
		// SPEC-GAP: the log says accepted strings are under the guard; read as a colliding
		// accepted string being ignored for fuzzy matching too.
		const verdict = grade({
			typed: 'datagram protocal',
			answer: 'TCP',
			accepted: ['Datagram Protocol'],
			others: [{ cardId: OTHER, text: 'datagram protocol' }]
		});
		expect(verdict.correct).toBe(false);
	});

	it('is deterministic: the same input gives an identical verdict and trace', () => {
		const input: TypedInput = {
			cardId: SELF,
			typed: 'decryption',
			answer: 'Encryption',
			accepted,
			others: [{ cardId: OTHER, text: 'Decryption' }]
		};
		expect(gradeTyped(input)).toEqual(gradeTyped(input));
	});
});

/** @see BUILD_PLAN §6.10 (accept list) and DATA_MODEL §3.6 (`acceptAdded`) */
describe('checkAccept', () => {
	const others: OtherAnswer[] = [
		{ cardId: SELF, text: 'TCP' },
		{ cardId: OTHER, text: 'UDP' }
	];

	it('passes a string that is no other card’s answer, returning it normalised', () => {
		const { result } = checkAccept(SELF, '  Transmission Control Protocol. ', others);
		expect(result.passesGuard).toBe(true);
		expect(result.normalized).toBe('transmission control protocol');
		expect(result.collidesWithCardId).toBeUndefined();
	});

	it('fails a string that equals another card’s answer after normalising', () => {
		const { result } = checkAccept(SELF, ' udp! ', others);
		expect(result).toMatchObject({
			normalized: 'udp',
			passesGuard: false,
			collidesWithCardId: OTHER
		});
	});

	it('ignores the card’s own answer in `others`', () => {
		expect(checkAccept(SELF, 'tcp', others).result.passesGuard).toBe(true);
	});

	it('applies immediately: a passing string is then graded as accepted', () => {
		const { result } = checkAccept(SELF, 'transport protocol', others);
		expect(result.passesGuard).toBe(true);
		const verdict = grade({
			typed: 'Transport Protocol',
			answer: 'TCP',
			accepted: [result.normalized],
			others
		});
		expect(verdict).toMatchObject({ correct: true, match: 'accepted' });
	});

	it('is deterministic: identical result and trace', () => {
		expect(checkAccept(SELF, 'udp', others)).toEqual(checkAccept(SELF, 'udp', others));
	});
});
