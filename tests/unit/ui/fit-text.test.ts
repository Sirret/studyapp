import { describe, expect, it } from 'vitest';
import type { CourseId } from '#lib/db/schemas/common.ts';
import type { PlanFitView } from '#lib/services/planner-types.ts';
import { fitText } from '#lib/ui/plan/fit-text.ts';
import { durationText } from '#lib/util/duration.ts';

/** One plan verdict for Home and Exam prep (Decisions "UX fix: one plan verdict"). */
const view = (overrides: Partial<PlanFitView> = {}): PlanFitView => ({
	courseId: 'c1' as CourseId,
	courseName: 'Networks',
	examDate: '2026-12-01',
	fits: true,
	fitsAfterCuts: true,
	shortfallMinutes: 0,
	degradations: [],
	cutCount: 0,
	...overrides
});

describe('fitText', () => {
	it('fits (or exactly fits): says so and cuts nothing', () => {
		const text = fitText(view());
		expect(text.tone).toBe('info');
		expect(text.body).toBe('This plan fits the time you have. Nothing is cut.');
		expect(text.body).not.toMatch(/short|left|leaves/);
	});

	it('fits after cuts: names the cuts and no shortfall', () => {
		const text = fitText(view({ fits: false, degradations: ['criterion', 'cut'], cutCount: 1 }));
		expect(text.tone).toBe('info');
		expect(text.body).toBe(
			'The plan asks new cards for 2 correct instead of 3 and leaves 1 piece of work until after the exam. Then it fits the time you have.'
		);
		expect(text.body).not.toMatch(/short/);
	});

	it('still short after cuts: the minutes left and the same cuts, with correct plurals', () => {
		const text = fitText(
			view({
				fits: false,
				fitsAfterCuts: false,
				shortfallMinutes: 68,
				degradations: ['criterion', 'relearning', 'cut'],
				cutCount: 3
			})
		);
		expect(text.tone).toBe('warning');
		expect(text.title).toBe("Not everything fits before Networks's exam");
		expect(text.body).toContain('plans fewer review sessions per card and leaves 3 pieces of work');
		expect(text.body).toContain("it's about 1 h 8 min short.");
	});

	it('short with nothing it can cut says only the shortfall', () => {
		const text = fitText(view({ fits: false, fitsAfterCuts: false, shortfallMinutes: 12 }));
		expect(text.body).toBe(
			"It's about 12 min short. Study what you can; the weakest cards come first."
		);
	});
});

describe('durationText', () => {
	it('minutes under an hour, then hours and minutes, never rounded hours', () => {
		expect(durationText(0)).toBe('0 min');
		expect(durationText(8)).toBe('8 min');
		expect(durationText(59.2)).toBe('1 h');
		expect(durationText(60)).toBe('1 h');
		expect(durationText(68)).toBe('1 h 8 min');
		expect(durationText(120)).toBe('2 h');
	});
});
