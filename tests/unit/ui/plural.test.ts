import { describe, expect, it } from 'vitest';
import { countOf } from '#lib/util/plural.ts';

/** SESSION_NOTES B: "1 comparison tables", "1 sequences" in the import preview. */
describe('countOf', () => {
	it('uses the singular for exactly one', () => {
		expect(countOf(1, 'comparison table')).toBe('1 comparison table');
		expect(countOf(1, 'sequence')).toBe('1 sequence');
	});

	it('uses the plural for zero and for more than one', () => {
		expect(countOf(0, 'card')).toBe('0 cards');
		expect(countOf(3, 'sequence')).toBe('3 sequences');
	});

	it('takes an irregular plural', () => {
		expect(countOf(2, 'reading chunk was', 'reading chunks were')).toBe('2 reading chunks were');
		expect(countOf(1, 'reading chunk was', 'reading chunks were')).toBe('1 reading chunk was');
	});
});
