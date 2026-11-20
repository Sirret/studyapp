import { describe, expect, it } from 'vitest';
import {
	blankFields,
	listDefinition,
	MANUAL_TYPES,
	manualFact,
	starTicked,
	wordsOf
} from '#lib/services/manual-fields.ts';

/** @see Decisions log "Phase 8.6 Q9", "Q15"; PROMPTS §3 (key words) */
describe('manual fact form', () => {
	it('splits a definition into words on spaces', () => {
		expect(wordsOf('  Data  sent in packets. ')).toEqual(['Data', 'sent', 'in', 'packets.']);
	});

	it('stars ticked words, joins neighbours and keeps edge punctuation outside', () => {
		const text = 'Data is split into small packets, routed (independently).';
		expect(starTicked(text, new Set([4, 5, 7]))).toBe(
			'Data is split into *small packets*, routed (*independently*).'
		);
		expect(starTicked(text, new Set())).toBe(text);
	});

	it('never stars a word that is only punctuation', () => {
		expect(starTicked('A - B', new Set([1]))).toBe('A - B');
	});

	it('writes a list definition the import reads as a list', () => {
		expect(listDefinition(['a', 'b'])).toBe('*a* and *b*');
		expect(listDefinition(['a', 'b', 'c'])).toBe('*a*, *b* and *c*');
	});

	it('makes a fact with the ticked key words', () => {
		const result = manualFact({
			kind: 'definition',
			term: 'Packet switching',
			definition: 'Data split into small packets, routed independently.',
			ticked: new Set([3, 4, 6])
		});
		expect(result).toStrictEqual({
			ok: true,
			value: {
				type: 'fact',
				payload: {
					term: 'Packet switching',
					definition: 'Data split into small packets, routed independently.',
					keyWords: ['small packets', 'independently']
				}
			}
		});
	});

	it('makes a list fact from items, one per line', () => {
		const result = manualFact({
			kind: 'list',
			term: 'OSI layers (top 3)',
			items: [' Application', 'Presentation', '', 'Session ']
		});
		expect(result).toStrictEqual({
			ok: true,
			value: {
				type: 'fact',
				payload: {
					term: 'OSI layers (top 3)',
					definition: 'Application, Presentation and Session',
					keyWords: ['Application', 'Presentation', 'Session'],
					list: true
				}
			}
		});
	});

	it('says what to fix', () => {
		expect(manualFact({ kind: 'list', term: 'T', items: ['only one'] }).ok).toBe(false);
		expect(manualFact({ kind: 'list', term: 'T', items: ['a*', 'b'] }).ok).toBe(false);
		const blank = manualFact({ kind: 'definition', term: '', definition: 'x', ticked: new Set() });
		expect(blank.ok).toBe(false);
	});

	it('offers every text type with empty boxes (no image types)', () => {
		const types = MANUAL_TYPES.map((t) => t.value);
		expect(new Set(types)).toEqual(
			new Set(['fact', 'keyterm', 'cloze', 'sequence', 'compare', 'scenario', 'example'])
		);
		for (const type of types) {
			const fields = blankFields(type);
			expect(fields.length).toBeGreaterThan(0);
			expect(fields.every((field) => field.value === '')).toBe(true);
		}
	});
});
