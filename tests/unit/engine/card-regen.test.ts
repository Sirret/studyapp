import { describe, expect, it } from 'vitest';
import type { CardId, MediaId } from '#lib/db/schemas/common.ts';
import type { NoteContent } from '#lib/engine/cardgen.ts';
import { planCardRegen, type ExistingCard } from '#lib/engine/card-regen.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as CardId;
const stored = (n: number, variant: string, path: ExistingCard['path']): ExistingCard => ({
	id: id(n),
	variant,
	path
});

const fact: NoteContent = { type: 'fact', payload: { term: 'a', definition: 'b' } };
const listFact: NoteContent = { type: 'fact', payload: { term: 'a', definition: 'b', list: true } };
const cloze = (text: string): NoteContent => ({ type: 'cloze', payload: { text } });
const MC_CLOZE: ExistingCard['path'] = ['mc', 'cloze'];

/** @see CLAUDE.md rule 7, DATA_MODEL §3.5, BUILD_PLAN §10 row 8.5 */
describe('planCardRegen', () => {
	it('keeps the stored card ID for a variant the edited note still has', () => {
		const { result } = planCardRegen(fact, [
			stored(1, 'fwd', MC_CLOZE),
			stored(2, 'rev', MC_CLOZE)
		]);
		expect(result.keep.map((k) => [k.variant, k.cardId])).toEqual([
			['fwd', id(1)],
			['rev', id(2)]
		]);
		expect(result.add).toEqual([]);
		expect(result.remove).toEqual([]);
	});

	it('adds every card as a CardSpec when there are no existing cards', () => {
		const { result } = planCardRegen(fact, []);
		expect(result.keep).toEqual([]);
		expect(result.remove).toEqual([]);
		expect(result.add).toEqual([
			{ variant: 'fwd', path: MC_CLOZE },
			{ variant: 'rev', path: MC_CLOZE }
		]);
	});

	it('adds a variant the note gained and keeps the others', () => {
		const { result } = planCardRegen(fact, [stored(1, 'fwd', MC_CLOZE)]);
		expect(result.keep.map((k) => k.cardId)).toEqual([id(1)]);
		expect(result.add).toEqual([{ variant: 'rev', path: MC_CLOZE }]);
		expect(result.remove).toEqual([]);
	});

	it('removes the IDs of variants the note lost', () => {
		const { result } = planCardRegen(listFact, [
			stored(1, 'fwd', MC_CLOZE),
			stored(2, 'rev', MC_CLOZE)
		]);
		expect(result.keep.map((k) => k.cardId)).toEqual([id(1)]);
		expect(result.remove).toEqual([id(2)]);
		expect(result.add).toEqual([]);
	});

	it('removes every stored card when none of its variants survive', () => {
		const { result } = planCardRegen(cloze('{{a}} and {{b}}'), [stored(1, 'fwd', MC_CLOZE)]);
		expect(result.remove).toEqual([id(1)]);
		expect(result.keep).toEqual([]);
		expect(result.add.map((c) => c.variant)).toEqual(['c1', 'c2']);
	});

	it('flags pathChanged false when the generated path equals the stored one', () => {
		const { result } = planCardRegen(fact, [stored(1, 'fwd', MC_CLOZE)]);
		expect(result.keep[0]).toEqual({
			cardId: id(1),
			variant: 'fwd',
			path: MC_CLOZE,
			pathChanged: false
		});
	});

	it('flags pathChanged true and returns the new path when the stored path differs', () => {
		const { result } = planCardRegen(fact, [stored(1, 'fwd', ['cloze'])]);
		expect(result.keep[0]).toEqual({
			cardId: id(1),
			variant: 'fwd',
			path: MC_CLOZE,
			pathChanged: true
		});
	});

	it('detects a path change when the path has the same kinds in another order or length', () => {
		const { result } = planCardRegen(fact, [
			stored(1, 'fwd', ['cloze', 'mc']),
			stored(2, 'rev', ['mc'])
		]);
		expect(result.keep.map((k) => k.pathChanged)).toEqual([true, true]);
	});

	it('keeps c1 and c2 and adds c3 when a cloze gains a blank', () => {
		const { result } = planCardRegen(cloze('{{a}} {{b}} {{c}}'), [
			stored(1, 'c1', ['cloze']),
			stored(2, 'c2', ['cloze'])
		]);
		expect(result.keep.map((k) => [k.variant, k.cardId, k.pathChanged])).toEqual([
			['c1', id(1), false],
			['c2', id(2), false]
		]);
		expect(result.add).toEqual([{ variant: 'c3', path: ['cloze'] }]);
		expect(result.remove).toEqual([]);
	});

	it('removes the last blank cards when a cloze loses a blank', () => {
		const { result } = planCardRegen(cloze('{{a}}'), [
			stored(1, 'c1', ['cloze']),
			stored(2, 'c2', ['cloze']),
			stored(3, 'c3', ['cloze'])
		]);
		expect(result.keep.map((k) => k.cardId)).toEqual([id(1)]);
		expect([...result.remove].sort()).toEqual([id(2), id(3)]);
		expect(result.add).toEqual([]);
	});

	it('puts every generated variant in keep or add, and every stored ID in keep or remove', () => {
		const existing = [stored(1, 'fwd', MC_CLOZE), stored(2, 'gone', ['cloze'])];
		const { result } = planCardRegen(fact, existing);
		const covered = [...result.keep.map((k) => k.variant), ...result.add.map((c) => c.variant)];
		expect(covered.sort()).toEqual(['fwd', 'rev']);
		expect([...result.keep.map((k) => k.cardId), ...result.remove].sort()).toEqual(
			existing.map((c) => c.id).sort()
		);
	});

	it('returns a trace', () => {
		const { trace } = planCardRegen(fact, [stored(1, 'fwd', MC_CLOZE)]);
		expect(Array.isArray(trace)).toBe(true);
		expect(trace.length).toBeGreaterThan(0);
		expect(trace.every((entry) => typeof entry.rule === 'string')).toBe(true);
	});

	it('is deterministic: same inputs give the same plan and trace', () => {
		const existing = [stored(1, 'fwd', ['cloze']), stored(2, 'x', ['cloze'])];
		expect(planCardRegen(fact, existing)).toEqual(planCardRegen(fact, existing));
	});

	describe('tombstones', () => {
		const OCC: ExistingCard['path'] = ['occlusionBank', 'occlusionDrag', 'occlusionType'];
		const occ = (label: string): NoteContent => ({
			type: 'occlusion',
			payload: {
				mediaId: '00000000-0000-4000-8000-0000000000aa' as MediaId,
				boxes: [{ id: 'b1', x: 0.1, y: 0.1, w: 0.2, h: 0.1, label }]
			}
		});
		const buried = (n: number, variant: string, path: ExistingCard['path']): ExistingCard => ({
			...stored(n, variant, path),
			deleted: true
		});

		it('revives the tombstoned card of an occlusion box named again, keeping its ID', () => {
			const { result } = planCardRegen(occ('Pool'), [buried(1, 'box:b1', OCC)]);
			expect(result.revive).toEqual([
				{ cardId: id(1), variant: 'box:b1', path: OCC, pathChanged: false }
			]);
			expect(result.add).toEqual([]);
			expect(result.keep).toEqual([]);
			expect(result.remove).toEqual([]);
		});

		it('never tombstones a card twice: a cleared box with a buried card plans nothing', () => {
			const { result } = planCardRegen(occ(''), [buried(1, 'box:b1', OCC)]);
			expect(result).toEqual({ keep: [], revive: [], add: [], remove: [] });
		});

		it('prefers a live card over a tombstone of the same variant', () => {
			const { result } = planCardRegen(occ('Pool'), [
				buried(1, 'box:b1', OCC),
				stored(2, 'box:b1', OCC)
			]);
			expect(result.keep.map((k) => k.cardId)).toEqual([id(2)]);
			expect(result.revive).toEqual([]);
		});

		it('does not revive positional variants (a cloze c2 back is a new card)', () => {
			const { result } = planCardRegen(cloze('{{a}} and {{b}}'), [
				stored(1, 'c1', ['cloze']),
				buried(2, 'c2', ['cloze'])
			]);
			expect(result.revive).toEqual([]);
			expect(result.add.map((c) => c.variant)).toEqual(['c2']);
			expect(result.remove).toEqual([]);
		});
	});

	it('does not mutate the existing cards', () => {
		const existing = [stored(1, 'fwd', ['cloze'])];
		const copy = structuredClone(existing);
		planCardRegen(fact, existing);
		expect(existing).toEqual(copy);
	});
});
