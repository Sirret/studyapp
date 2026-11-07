import { describe, expect, it } from 'vitest';
import type { MediaId } from '#lib/db/schemas/common.ts';
import {
	clozeAnswers,
	generateCards,
	type CardSpec,
	type NoteContent
} from '#lib/engine/cardgen.ts';

const variants = (cards: CardSpec[]) => cards.map((card) => card.variant);
const cardsFor = (note: NoteContent) => generateCards(note).result;

/** @see BUILD_PLAN §5 and DATA_MODEL §4.3 */
describe('generateCards', () => {
	it('gives a keyterm one forward card, multiple choice then cloze', () => {
		expect(cardsFor({ type: 'keyterm', payload: { term: 'a', meaning: 'b' } })).toEqual([
			{ variant: 'fwd', path: ['mc', 'cloze'] }
		]);
	});

	it('gives a fact a forward and a reverse card', () => {
		expect(cardsFor({ type: 'fact', payload: { term: 'a', definition: 'b' } })).toEqual([
			{ variant: 'fwd', path: ['mc', 'cloze'] },
			{ variant: 'rev', path: ['mc', 'cloze'] }
		]);
	});

	it('gives a cloze one card per answer, numbered from c1', () => {
		expect(cardsFor({ type: 'cloze', payload: { text: '{{a}} x {{b}} y {{c}}' } })).toEqual([
			{ variant: 'c1', path: ['cloze'] },
			{ variant: 'c2', path: ['cloze'] },
			{ variant: 'c3', path: ['cloze'] }
		]);
	});

	it('gives a sequence a whole-order card and a next-step card for all but the last step', () => {
		expect(cardsFor({ type: 'sequence', payload: { name: 'S', steps: ['a', 'b', 'c'] } })).toEqual([
			{ variant: 'seq', path: ['sequence', 'parsons'] },
			{ variant: 'step:0', path: ['whichOne', 'cloze'] },
			{ variant: 'step:1', path: ['whichOne', 'cloze'] }
		]);
	});

	it('gives a compare table row, cell and which cards, row by row', () => {
		const cards = cardsFor({
			type: 'compare',
			payload: {
				items: ['A', 'B'],
				rows: [
					{ attribute: 'x', values: ['1', '2'] },
					{ attribute: 'y', values: ['3', '4'] }
				]
			}
		});
		expect(variants(cards)).toEqual([
			'row:0',
			'cell:0:0',
			'cell:0:1',
			'which:0',
			'row:1',
			'cell:1:0',
			'cell:1:1',
			'which:1'
		]);
		expect(cards[0]?.path).toEqual(['tableRow']);
		expect(cards[1]?.path).toEqual(['cloze']);
		expect(cards[3]?.path).toEqual(['whichOne', 'scenario']);
	});

	it('gives a scenario one card', () => {
		expect(cardsFor({ type: 'scenario', payload: { situation: 'a', answer: 'b' } })).toEqual([
			{ variant: 'fwd', path: ['scenario'] }
		]);
	});

	it('gives an example one card that fades one step per subgoal', () => {
		const steps = [
			{ subgoal: 'a', step: 'b' },
			{ subgoal: 'c', step: 'd' },
			{ subgoal: 'e', step: 'f' }
		];
		expect(cardsFor({ type: 'example', payload: { name: 'E', steps } })).toEqual([
			{
				variant: 'ex',
				path: ['exampleStudy', 'fadeStep', 'fadeStep', 'fadeStep', 'newInstance', 'subgoalMatch']
			}
		]);
	});

	it('gives a stack diagram an order card and a card per layer, by node ID', () => {
		const nodes = [
			{ id: 'n1', label: 'a' },
			{ id: 'n2', label: 'b' }
		];
		expect(
			cardsFor({ type: 'diagram', payload: { kind: 'stack', name: 'S', nodes, edges: [] } })
		).toEqual([
			{ variant: 'layers', path: ['layerOrder'] },
			{ variant: 'layer:n1', path: ['nodeCloze'] },
			{ variant: 'layer:n2', path: ['nodeCloze'] }
		]);
	});

	it('gives a flow diagram node, edge and rebuild cards, by ID', () => {
		const nodes = [
			{ id: 'n1', label: 'a' },
			{ id: 'n2', label: 'b' }
		];
		const edges = [{ id: 'e1', from: 'n1', to: 'n2' }];
		expect(
			cardsFor({ type: 'diagram', payload: { kind: 'flow', name: 'F', nodes, edges } })
		).toEqual([
			{ variant: 'node:n1', path: ['nodeCloze'] },
			{ variant: 'node:n2', path: ['nodeCloze'] },
			{ variant: 'edge:e1', path: ['edgeCloze'] },
			{ variant: 'rebuild', path: ['structureRebuild'] }
		]);
	});

	it('gives occlusion a card per box, and none before boxes exist', () => {
		const mediaId = 'media' as MediaId;
		expect(cardsFor({ type: 'occlusion', payload: { mediaId, boxes: [] } })).toEqual([]);
		const boxes = [{ id: 'b1', x: 0, y: 0, w: 1, h: 1, label: 'a' }];
		expect(cardsFor({ type: 'occlusion', payload: { mediaId, boxes } })).toEqual([
			{ variant: 'box:b1', path: ['occlusionBank', 'occlusionType'] }
		]);
	});

	it('gives every variant of a note a different name', () => {
		const cards = cardsFor({
			type: 'compare',
			payload: { items: ['A', 'B'], rows: [{ attribute: 'x', values: ['1', '1'] }] }
		});
		expect(new Set(variants(cards)).size).toBe(cards.length);
	});
});

describe('clozeAnswers', () => {
	it('returns each answer in order, trimmed', () => {
		expect(clozeAnswers('{{a}} and {{ b c }}')).toEqual(['a', 'b c']);
	});

	it('keeps repeated answers, since each has its own card', () => {
		expect(clozeAnswers('{{a}} {{a}}')).toEqual(['a', 'a']);
	});

	it('returns nothing when there are no answers', () => {
		expect(clozeAnswers('plain')).toEqual([]);
	});
});
