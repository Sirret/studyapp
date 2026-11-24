import { describe, expect, it } from 'vitest';
import type { CourseId } from '#lib/db/schemas/common.ts';
import { recentFirst } from '#lib/services/course-order.ts';

/** The import picker lists courses most recently used first (Decisions "UX fix: import course picker"). */
const course = (id: string, name: string, updatedAt: number) => ({
	id: id as CourseId,
	name,
	updatedAt
});

describe('recentFirst', () => {
	it('orders by the later of the last change and the last session, newest first', () => {
		const courses = [course('a', 'Alpha', 100), course('b', 'Beta', 50), course('c', 'Gamma', 10)];
		const sessions = new Map<CourseId, number>([['c' as CourseId, 500]]);
		expect(recentFirst(courses, sessions).map((c) => c.name)).toEqual(['Gamma', 'Alpha', 'Beta']);
	});

	it('breaks ties by name and does not change the input', () => {
		const courses = [course('b', 'Beta', 7), course('a', 'Alpha', 7)];
		const copy = structuredClone(courses);
		expect(recentFirst(courses, new Map()).map((c) => c.name)).toEqual(['Alpha', 'Beta']);
		expect(courses).toEqual(copy);
	});
});
