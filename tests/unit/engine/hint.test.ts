import { describe, expect, it } from 'vitest';
import { HINT_LETTERS, HINT_WORDS } from '#lib/config/defaults.ts';
import type { ExerciseKind } from '#lib/db/schemas/common.ts';
import type { ExerciseSpec, SpecBase } from '#lib/engine/exercise-types.ts';
import { microHint } from '#lib/engine/hint.ts';
import { createRng } from '#lib/engine/rng.ts';
import { cardId, deepFreeze } from './fixtures.ts';

/**
 * The micro hint: one per attempt, per spec shape.
 *
 * @see SESSION_NOTES J (micro hint); Decisions log "Phase 8.6 Q10"
 */

const base = (kind: ExerciseKind): SpecBase => ({
	kind,
	cardId: cardId(1),
	prompt: 'prompt',
	instruction: 'do it'
});

const typeSpec = (answer: string): ExerciseSpec => ({
	...base('cloze'),
	shape: 'type',
	answer,
	accepted: [],
	others: [],
	letter: null,
	context: []
});

const ideaSpec = (answer: string): ExerciseSpec => ({
	...base('ideaUnit'),
	shape: 'ideaUnit',
	answer,
	keyWords: ['x']
});

const listSpec = (items: string[]): ExerciseSpec => ({
	...base('listAll'),
	shape: 'list',
	entry: 'type',
	items,
	required: items.length,
	options: [],
	correct: []
});

const chooseSpec = (n: number, correctIndex: number): ExerciseSpec => ({
	...base('mc'),
	shape: 'choose',
	options: Array.from({ length: n }, (_x, i) => ({ text: `option ${i}` })),
	correctIndex,
	letter: null
});

const hint = (spec: ExerciseSpec, seed = 1) => microHint(spec, createRng(seed)).result;

describe('microHint for typed answers', () => {
	it('reveals the first HINT_LETTERS letters of a one-word answer, the rest as "_"', () => {
		expect(HINT_LETTERS).toBe(2);
		// SPEC-GAP: one "_" per hidden letter (reading) or a single "_"?
		expect(hint(typeSpec('firewall'))).toEqual({ kind: 'reveal', text: 'fi______' });
	});

	it('does this per word for an answer of up to HINT_WORDS words', () => {
		expect(hint(typeSpec('hash table'))).toEqual({ kind: 'reveal', text: 'ha__ ta___' });
		const exactly = Array.from({ length: HINT_WORDS }, () => 'router').join(' ');
		const text = (hint(typeSpec(exactly)) as { text: string }).text;
		expect(text.split(' ')).toHaveLength(HINT_WORDS);
		expect(text.split(' ').every((word) => word === 'ro____')).toBe(true);
	});

	it('shows only the first letter of a word no longer than HINT_LETTERS', () => {
		expect(hint(typeSpec('ip'))).toEqual({ kind: 'reveal', text: 'i_' });
		expect(hint(typeSpec('a'))).toEqual({ kind: 'reveal', text: 'a' });
	});

	it('shows the first HINT_WORDS words then an ellipsis for a longer answer', () => {
		const result = hint(typeSpec('the quick brown fox jumps'));
		expect(result.kind).toBe('reveal');
		const text = (result as { text: string }).text;
		expect(text.startsWith('the quick brown')).toBe(true);
		expect(text.endsWith('…')).toBe(true);
		expect(text).not.toContain('fox');
	});

	it('treats an ideaUnit answer like a typed one', () => {
		expect(hint(ideaSpec('firewall'))).toEqual({ kind: 'reveal', text: 'fi______' });
		const text = (hint(ideaSpec('a rule set that filters network traffic')) as { text: string })
			.text;
		expect(text.startsWith('a rule set')).toBe(true);
		expect(text.endsWith('…')).toBe(true);
		expect(text).not.toContain('filters');
	});

	it('never reveals the whole of a long answer', () => {
		const answer = 'a very long definition of many words indeed';
		expect((hint(typeSpec(answer)) as { text: string }).text).not.toBe(answer);
	});
});

describe('microHint for lists', () => {
	it('shows the first HINT_WORDS words of the items, joined by ", ", then an ellipsis', () => {
		const result = hint(listSpec(['virus', 'worm', 'trojan', 'spyware', 'adware']));
		expect(result.kind).toBe('reveal');
		const text = (result as { text: string }).text;
		expect(text.startsWith('virus, worm, trojan')).toBe(true);
		expect(text.endsWith('…')).toBe(true);
		expect(text).not.toContain('spyware');
		// SPEC-GAP: items with several words each (how the HINT_WORDS words are cut) are untested.
	});
});

describe('microHint for choices', () => {
	it('removes one wrong option, never the correct one', () => {
		for (let seed = 0; seed < 40; seed += 1) {
			const result = hint(chooseSpec(4, 2), seed);
			expect(result.kind).toBe('remove');
			const index = (result as { index: number }).index;
			expect(index).not.toBe(2);
			expect(index).toBeGreaterThanOrEqual(0);
			expect(index).toBeLessThan(4);
		}
	});

	it('picks the removed option with the rng (several wrong options get picked over seeds)', () => {
		const seen = new Set<number>();
		for (let seed = 0; seed < 60; seed += 1) {
			seen.add((hint(chooseSpec(4, 0), seed) as { index: number }).index);
		}
		expect([...seen].sort()).toEqual([1, 2, 3]);
	});

	it('is deterministic for the same seed', () => {
		expect(microHint(chooseSpec(4, 1), createRng(9))).toEqual(
			microHint(chooseSpec(4, 1), createRng(9))
		);
	});
});

describe('microHint for other shapes', () => {
	const none = { kind: 'none' };
	it.each([
		[
			'chooseMany',
			{
				...base('multiSelect'),
				shape: 'chooseMany',
				options: [{ text: 'a' }, { text: 'b' }],
				correct: [0]
			}
		],
		[
			'order',
			{ ...base('sequence'), shape: 'order', items: ['a', 'b'], correctOrder: [0, 1], extras: [] }
		],
		['pair', { ...base('matching'), shape: 'pair', left: ['a'], right: ['b'], pairs: [0] }],
		['sort', { ...base('categorize'), shape: 'sort', buckets: ['x'], items: ['a'], bucketOf: [0] }],
		['selfRate', { ...base('flip'), shape: 'selfRate', answer: 'a', checklist: [] }],
		['study', { ...base('exampleStudy'), shape: 'study', steps: [] }]
	] as [string, ExerciseSpec][])('gives no hint for %s', (_shape, spec) => {
		expect(hint(spec)).toEqual(none);
	});
});

describe('microHint general rules', () => {
	it('does not change the spec', () => {
		const spec = deepFreeze(typeSpec('firewall'));
		expect(() => microHint(spec, createRng(1))).not.toThrow();
	});

	it('is deterministic for typed answers and returns a trace array', () => {
		const a = microHint(typeSpec('firewall'), createRng(3));
		expect(microHint(typeSpec('firewall'), createRng(3))).toEqual(a);
		expect(Array.isArray(a.trace)).toBe(true);
	});
});
