import { describe, expect, it } from 'vitest';
import type { MediaId } from '../../../src/lib/db/schemas/common.ts';
import type { NoteContent } from '../../../src/lib/engine/cardgen.ts';
import {
	fromEditFields,
	toEditFields,
	type EditableType
} from '../../../src/lib/services/note-edit.ts';

/** The editor's boxes as a key → value record. */
function valuesOf(content: NoteContent): Record<string, string> {
	const fields = toEditFields(content);
	if (!fields) throw new Error('not editable');
	return Object.fromEntries(fields.map((f) => [f.key, f.value]));
}

const ROUND_TRIP: NoteContent[] = [
	{ type: 'keyterm', payload: { term: 'TCP', meaning: 'Transmission Control Protocol' } },
	{ type: 'fact', payload: { term: 'TCP', definition: 'reliable, ordered delivery' } },
	{
		type: 'fact',
		payload: {
			term: 'ACID',
			definition: 'Changes are atomic and stay isolated',
			keyWords: ['atomic', 'isolated']
		}
	},
	{
		type: 'fact',
		payload: {
			term: 'Layers',
			definition: 'link, network',
			keyWords: ['link', 'network'],
			list: true
		}
	},
	{ type: 'cloze', payload: { text: 'A {{key}} identifies a {{row}}.' } },
	{ type: 'sequence', payload: { name: 'Handshake', steps: ['SYN', 'SYN-ACK', 'ACK'] } },
	{
		type: 'example',
		payload: {
			name: 'Normalise',
			steps: [
				{ subgoal: 'Find keys', step: 'List candidate keys' },
				{ subgoal: 'Split', step: 'Make one table per dependency' }
			]
		}
	},
	{
		type: 'compare',
		payload: {
			items: ['TCP', 'UDP'],
			rows: [
				{ attribute: 'Reliable', values: ['yes', 'no'] },
				{ attribute: 'Ordered', values: ['yes', 'no'] }
			]
		}
	},
	{ type: 'scenario', payload: { situation: 'Video call drops frames', answer: 'UDP' } }
];

describe('toEditFields / fromEditFields', () => {
	it.each(ROUND_TRIP.map((c) => [c.type, c] as const))('round-trips a %s note', (_, content) => {
		const result = fromEditFields(content.type as EditableType, valuesOf(content));
		expect(result).toEqual({ ok: true, value: content });
	});

	it('stars the key words of a fact again for editing', () => {
		const fields = toEditFields(ROUND_TRIP[2] as NoteContent);
		expect(fields?.find((f) => f.key === 'definition')?.value).toBe(
			'Changes are *atomic* and stay *isolated*'
		);
	});

	it('gives image notes no text editor', () => {
		const occlusion: NoteContent = {
			type: 'occlusion',
			payload: { mediaId: crypto.randomUUID() as MediaId, boxes: [] }
		};
		expect(toEditFields(occlusion)).toBeNull();
	});

	it('applies an edit', () => {
		const result = fromEditFields('keyterm', { term: ' UDP ', meaning: 'User Datagram Protocol' });
		expect(result).toEqual({
			ok: true,
			value: { type: 'keyterm', payload: { term: 'UDP', meaning: 'User Datagram Protocol' } }
		});
	});

	it('rejects an empty box', () => {
		expect(fromEditFields('keyterm', { term: 'TCP', meaning: '  ' }).ok).toBe(false);
	});

	it('rejects a cloze without a blank', () => {
		expect(fromEditFields('cloze', { text: 'No blanks here' }).ok).toBe(false);
	});

	it('rejects a sequence with one step', () => {
		expect(fromEditFields('sequence', { name: 'X', steps: 'only one' }).ok).toBe(false);
	});

	it('rejects a worked-example step without ::', () => {
		expect(fromEditFields('example', { name: 'X', steps: 'a :: b\njust text' }).ok).toBe(false);
	});

	it('rejects a comparison row with the wrong number of values', () => {
		const result = fromEditFields('compare', { items: 'TCP\nUDP', rows: 'Reliable :: yes' });
		expect(result.ok).toBe(false);
	});

	it('ignores blank lines in lists', () => {
		const result = fromEditFields('sequence', { name: 'X', steps: 'a\n\n b \n' });
		expect(result).toEqual({
			ok: true,
			value: { type: 'sequence', payload: { name: 'X', steps: ['a', 'b'] } }
		});
	});
});
