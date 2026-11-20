import { describe, expect, it } from 'vitest';
import type { StudyScope } from '#lib/db/schemas/kv.ts';
import { inScope, isWholeCourse, scopeItems, scopeSummary } from '#lib/engine/scope.ts';
import { chunkId, deepFreeze, topicId } from './fixtures.ts';

/**
 * The per-course study selection ("Study all" by default).
 *
 * @see SESSION_NOTES J; Decisions log "Phase 8.6 Q12"
 */

const T1 = topicId(1);
const T2 = topicId(2);
const T3 = topicId(3);
const C1 = chunkId(11); // a section of T1
const C2 = chunkId(12); // a section of T2
const C3 = chunkId(13); // a section of T3

const scope = (topicIds: (typeof T1)[], chunkIds: (typeof C1)[]): StudyScope => ({
	topicIds,
	chunkIds
});

describe('isWholeCourse', () => {
	it('is true when no scope is stored', () => {
		expect(isWholeCourse(undefined)).toBe(true);
	});
	it('is true when both lists are empty', () => {
		expect(isWholeCourse(scope([], []))).toBe(true);
	});
	it('is false when any topic or section is listed', () => {
		expect(isWholeCourse(scope([T1], []))).toBe(false);
		expect(isWholeCourse(scope([], [C1]))).toBe(false);
	});
});

describe('inScope', () => {
	it('includes everything for the whole course', () => {
		expect(inScope({ topicId: T1, chunkId: C1 }, undefined)).toBe(true);
		expect(inScope({ topicId: T3 }, scope([], []))).toBe(true);
	});

	it('includes an item whose topic is listed, whatever its section', () => {
		expect(inScope({ topicId: T1, chunkId: C1 }, scope([T1], []))).toBe(true);
		expect(inScope({ topicId: T1, chunkId: chunkId(99) }, scope([T1], [C2]))).toBe(true);
		expect(inScope({ topicId: T1 }, scope([T1], []))).toBe(true);
	});

	it('includes an item whose section is listed even if its topic is not', () => {
		expect(inScope({ topicId: T2, chunkId: C2 }, scope([T1], [C2]))).toBe(true);
	});

	it('excludes an item whose topic and section are both unlisted', () => {
		expect(inScope({ topicId: T3, chunkId: C3 }, scope([T1], [C2]))).toBe(false);
	});

	it('includes an item with no section only through its topic', () => {
		expect(inScope({ topicId: T2, chunkId: null }, scope([T1], [C2]))).toBe(false);
		expect(inScope({ topicId: T2, chunkId: null }, scope([T2], []))).toBe(true);
		expect(inScope({ topicId: T2 }, scope([], [C2]))).toBe(false);
	});
});

describe('scopeItems', () => {
	const items = [
		{ id: 'a', topicId: T1, chunkId: C1 },
		{ id: 'b', topicId: T2, chunkId: C2 },
		{ id: 'c', topicId: T3, chunkId: null },
		{ id: 'd', topicId: T1, chunkId: null },
		{ id: 'e', topicId: T3, chunkId: C3 }
	];

	it('returns every item, in order, for the whole course', () => {
		expect(scopeItems(items, undefined)).toEqual(items);
	});

	it('keeps only in-scope items, in their given order', () => {
		const result = scopeItems(items, scope([T1], [C3]));
		expect(result.map((i) => i.id)).toEqual(['a', 'd', 'e']);
	});

	it('returns an empty list for empty input and for a scope that matches nothing', () => {
		expect(scopeItems([], scope([T1], []))).toEqual([]);
		expect(scopeItems(items, scope([topicId(77)], [chunkId(78)]))).toEqual([]);
	});

	it('does not change its input', () => {
		const frozen = deepFreeze([...items]);
		expect(() => scopeItems(frozen, scope([T1], []))).not.toThrow();
	});
});

describe('scopeSummary ("Studying N of M topics")', () => {
	const topics = [
		{ id: T1, chunkIds: [C1] },
		{ id: T2, chunkIds: [C2] },
		{ id: T3, chunkIds: [C3, chunkId(14)] }
	];

	it('counts every topic and sets whole for the whole course', () => {
		expect(scopeSummary(topics, undefined)).toEqual({ topics: 3, of: 3, whole: true });
		expect(scopeSummary(topics, scope([], []))).toEqual({ topics: 3, of: 3, whole: true });
	});

	it('counts a listed topic', () => {
		expect(scopeSummary(topics, scope([T1, T2], []))).toEqual({ topics: 2, of: 3, whole: false });
	});

	it('counts a topic one of whose sections is listed', () => {
		expect(scopeSummary(topics, scope([], [chunkId(14)]))).toEqual({
			topics: 1,
			of: 3,
			whole: false
		});
	});

	it('counts a topic once when both it and its sections are listed', () => {
		expect(scopeSummary(topics, scope([T3], [C3, chunkId(14)]))).toEqual({
			topics: 1,
			of: 3,
			whole: false
		});
	});

	it('ignores listed ids that match no topic', () => {
		expect(scopeSummary(topics, scope([topicId(88)], [chunkId(89)]))).toEqual({
			topics: 0,
			of: 3,
			whole: false
		});
	});

	it('handles a course with no topics', () => {
		expect(scopeSummary([], undefined)).toEqual({ topics: 0, of: 0, whole: true });
	});
});
