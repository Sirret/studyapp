import { describe, expect, it } from 'vitest';
import type { Mode, Weight } from '#lib/db/schemas/common.ts';
import { queueWeight } from '#lib/engine/practice.ts';

const MODES: Mode[] = ['acquisition', 'cram', 'longterm', 'onenight', 'practice'];
const WEIGHTS: Weight[] = ['full', 'recognition', 'none'];

/** @see Decisions log "Phase 8.6 Q4", "Q18" (Practice asks every card once) */
describe('queueWeight', () => {
	it('counts a practice recognition answer as full, so one correct finishes the card', () => {
		expect(queueWeight('practice', 'recognition')).toBe('full');
	});

	it('keeps full and none in practice', () => {
		expect(queueWeight('practice', 'full')).toBe('full');
		expect(queueWeight('practice', 'none')).toBe('none');
	});

	it('changes nothing outside practice', () => {
		for (const mode of MODES.filter((m) => m !== 'practice')) {
			for (const weight of WEIGHTS) expect(queueWeight(mode, weight)).toBe(weight);
		}
	});
});
