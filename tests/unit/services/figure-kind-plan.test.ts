import { describe, expect, it } from 'vitest';
import type { CardId } from '#lib/db/schemas/common.ts';
import { figureKindPlan, type SampleCard } from '#lib/services/dev-sample.ts';

const card = (id: string, noteType: SampleCard['noteType']): SampleCard => ({
	id: id as CardId,
	variant: id,
	noteType,
	noteKey: ''
});

/** The e2e figure harness (WIP step 9): one session shows every figure kind. */
describe('figureKindPlan', () => {
	it('forces the first three box cards to bank, place and type, and keeps diagram cards', () => {
		const plan = figureKindPlan([
			card('k1', 'keyterm'),
			card('b1', 'occlusion'),
			card('d1', 'diagram'),
			card('b2', 'occlusion'),
			card('b3', 'occlusion'),
			card('b4', 'occlusion')
		]);
		expect(plan.cardIds).toEqual(['b1', 'b2', 'b3', 'b4', 'd1']);
		expect(plan.forceKinds).toEqual({
			b1: 'occlusionBank',
			b2: 'occlusionDrag',
			b3: 'occlusionType'
		});
	});

	it('forces only as many kinds as there are box cards', () => {
		const plan = figureKindPlan([card('b1', 'occlusion')]);
		expect(plan.forceKinds).toEqual({ b1: 'occlusionBank' });
	});
});
