import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	DEV_SEED_ANSWERS_PER_DAY,
	DEV_SEED_HISTORY_DAYS,
	DEV_SEED_SHELF_COURSES
} from '#lib/config/defaults.ts';
import type { CardId } from '#lib/db/schemas/common.ts';
import { CourseSchema } from '#lib/db/schemas/course.ts';
import { SAMPLE_COURSE_TEXT } from '#lib/services/dev-sample.ts';
import {
	imageNames,
	richSeedPlan,
	shelfSeedPlan,
	syntheticAnswers
} from '#lib/services/dev-seed-plan.ts';

/** @see Decisions log "Pre-review step: /dev/seed" */
const golden = (name: string) => readFileSync(`tests/golden/import/${name}.txt`, 'utf8');
const texts = {
	figures: golden('figures'),
	full: golden('full'),
	malformed: golden('malformed'),
	sample: SAMPLE_COURSE_TEXT
};
const nameSchema = CourseSchema.shape.name;

describe('richSeedPlan', () => {
	const plan = richSeedPlan(texts);

	it('makes six courses with history, staggered exams and one long-term course', () => {
		expect(plan).toHaveLength(6);
		expect(plan.every((c) => c.history)).toBe(true);
		const exams = plan.map((c) => c.examInDays);
		expect(exams.filter((d) => d === null)).toHaveLength(1);
		expect(new Set(exams).size).toBe(6);
	});

	it('includes occlusion with box: lines, a stack and a flow diagram, with their pictures', () => {
		const figures = plan.filter((c) => c.text === texts.figures);
		expect(figures.length).toBeGreaterThan(0);
		for (const text of ['box: ', '@diagram stack', '@diagram flow', '@occlusion']) {
			expect(texts.figures).toContain(text);
		}
		expect(figures[0]?.images).toEqual(['query-plan.png', 'buffer_manager.png', 'b-tree-node.png']);
	});
});

describe('shelfSeedPlan', () => {
	const plan = shelfSeedPlan();

	it(`makes ${DEV_SEED_SHELF_COURSES} valid, distinct course names, some very long or odd`, () => {
		expect(plan).toHaveLength(DEV_SEED_SHELF_COURSES);
		expect(new Set(plan.map((c) => c.name)).size).toBe(DEV_SEED_SHELF_COURSES);
		for (const c of plan) expect(nameSchema.safeParse(c.name).success).toBe(true);
		expect(plan.filter((c) => c.name.length >= 100).length).toBeGreaterThanOrEqual(3);
		expect(plan.some((c) => c.name.length <= 2)).toBe(true);
	});

	it('mixes exam dates: soon, far, past, and some with none; no history', () => {
		const exams = plan.map((c) => c.examInDays);
		expect(exams.filter((d) => d === null).length).toBeGreaterThanOrEqual(10);
		expect(exams.some((d) => d !== null && d < 0)).toBe(true);
		expect(exams.some((d) => d !== null && d >= 30)).toBe(true);
		expect(plan.every((c) => !c.history && c.images.length === 0)).toBe(true);
	});
});

describe('imageNames', () => {
	it('lists occlusion and diagram source pictures once each, in order', () => {
		const text = '@occlusion a.png\nsource: b.jpg\n@occlusion a.png\nsource: notes.txt';
		expect(imageNames(text)).toEqual(['a.png', 'b.jpg']);
	});
});

describe('syntheticAnswers', () => {
	const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as CardId;
	const cards = [1, 2, 3, 4, 5].map((n) => ({ id: id(n), kind: 'mc' as const }));

	it('is the same for the same seed and key, and differs by key', () => {
		expect(syntheticAnswers(cards, 'course-a', 7)).toEqual(syntheticAnswers(cards, 'course-a', 7));
		expect(syntheticAnswers(cards, 'course-a', 7)).not.toEqual(
			syntheticAnswers(cards, 'course-b', 7)
		);
	});

	it('gives a fixed number of answers per day, oldest day first, never today', () => {
		const answers = syntheticAnswers(cards, 'k', 1);
		expect(answers).toHaveLength(DEV_SEED_HISTORY_DAYS * DEV_SEED_ANSWERS_PER_DAY);
		const days = answers.map((a) => a.daysAgo);
		expect(days).toEqual([...days].sort((a, b) => b - a));
		expect(Math.min(...days)).toBe(1);
		expect(answers.some((a) => a.correct) && answers.some((a) => !a.correct)).toBe(true);
		expect(new Set(answers.map((a) => a.cardId)).size).toBe(cards.length);
	});

	it('gives nothing for a course with no cards', () => {
		expect(syntheticAnswers([], 'k', 1)).toEqual([]);
	});
});
