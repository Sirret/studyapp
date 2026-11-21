import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { OCCLUSION_MIN_BOX, OCCLUSION_NEW_BOX } from '#lib/config/defaults.ts';
import type { FractionBox } from '#lib/engine/grading-shapes.ts';
import {
	addBox,
	clampBox,
	moveBox,
	placeLabel,
	removeBox,
	resizeBox,
	type OcclusionBoxes
} from '#lib/engine/occlusion-edit.ts';
import { NUM_RUNS, uuid } from './fixtures.ts';

const EPS = 1e-9;
const idSource = (start = 0x900) => {
	let next = start;
	const issued: string[] = [];
	return {
		newId: () => {
			const id = uuid(next);
			next += 1;
			issued.push(id);
			return id;
		},
		issued
	};
};

const payload = (): OcclusionBoxes => ({
	boxes: [
		{ id: uuid(1), x: 0.1, y: 0.1, w: 0.2, h: 0.1, label: 'Zebra' },
		{ id: uuid(2), x: 0.5, y: 0.5, w: 0.3, h: 0.2, label: 'Yak' },
		{ id: uuid(3), x: 0.7, y: 0.1, w: 0.1, h: 0.1, label: '' }
	],
	unplaced: ['Walrus', 'Vole']
});

const inBounds = (box: FractionBox): void => {
	expect(box.x).toBeGreaterThanOrEqual(-EPS);
	expect(box.y).toBeGreaterThanOrEqual(-EPS);
	expect(box.x + box.w).toBeLessThanOrEqual(1 + EPS);
	expect(box.y + box.h).toBeLessThanOrEqual(1 + EPS);
	expect(box.w).toBeGreaterThanOrEqual(OCCLUSION_MIN_BOX - EPS);
	expect(box.h).toBeGreaterThanOrEqual(OCCLUSION_MIN_BOX - EPS);
};

const boxById = (p: OcclusionBoxes, id: string) => p.boxes.find((b) => b.id === id);

// ---------------------------------------------------------------------------------------------

describe('clampBox: boxes stay on the image (BUILD_PLAN §7.1)', () => {
	it('leaves a box that is already inside unchanged', () => {
		const box = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
		expect(clampBox(box)).toEqual(box);
	});

	it('keeps other properties of the box (id, label)', () => {
		const box = { id: uuid(1), label: 'Zebra', x: -0.2, y: 0.2, w: 0.3, h: 0.4 };
		const out = clampBox(box);
		expect(out.id).toBe(uuid(1));
		expect(out.label).toBe('Zebra');
	});

	it('moves, not shrinks, a box that sticks out on the left or top', () => {
		expect(clampBox({ x: -0.3, y: -0.1, w: 0.2, h: 0.2 })).toEqual({ x: 0, y: 0, w: 0.2, h: 0.2 });
	});

	it('moves, not shrinks, a box that sticks out on the right or bottom', () => {
		const out = clampBox({ x: 0.9, y: 0.95, w: 0.25, h: 0.2 });
		expect(out.w).toBeCloseTo(0.25, 9);
		expect(out.h).toBeCloseTo(0.2, 9);
		expect(out.x).toBeCloseTo(0.75, 9);
		expect(out.y).toBeCloseTo(0.8, 9);
	});

	it('raises a width or height below OCCLUSION_MIN_BOX to that minimum', () => {
		const out = clampBox({ x: 0.2, y: 0.2, w: 0, h: -0.5 });
		expect(out.w).toBe(OCCLUSION_MIN_BOX);
		expect(out.h).toBe(OCCLUSION_MIN_BOX);
	});

	it('lowers a width or height above 1 to 1, at the origin', () => {
		expect(clampBox({ x: 0.4, y: 0.4, w: 3, h: 1.5 })).toEqual({ x: 0, y: 0, w: 1, h: 1 });
	});

	it('always lands in [0, 1], at least the minimum size, and is idempotent (property)', () => {
		const n = fc.double({ min: -3, max: 3, noNaN: true });
		fc.assert(
			fc.property(n, n, n, n, (x, y, w, h) => {
				const out = clampBox({ x, y, w, h });
				inBounds(out);
				const again = clampBox(out);
				for (const key of ['x', 'y', 'w', 'h'] as const)
					expect(again[key]).toBeCloseTo(out[key], 9);
			}),
			{ numRuns: NUM_RUNS }
		);
	});

	it('keeps the size of a box whose size is already valid (property)', () => {
		fc.assert(
			fc.property(
				fc.double({ min: -2, max: 2, noNaN: true }),
				fc.double({ min: -2, max: 2, noNaN: true }),
				fc.double({ min: OCCLUSION_MIN_BOX, max: 1, noNaN: true }),
				fc.double({ min: OCCLUSION_MIN_BOX, max: 1, noNaN: true }),
				(x, y, w, h) => {
					const out = clampBox({ x, y, w, h });
					expect(out.w).toBeCloseTo(w, 9);
					expect(out.h).toBeCloseTo(h, 9);
				}
			),
			{ numRuns: NUM_RUNS }
		);
	});
});

describe('addBox', () => {
	it('appends a box with a new ID and the trimmed label, and keeps the others', () => {
		const { newId, issued } = idSource();
		const before = payload();
		const out = addBox(before, { x: 0.2, y: 0.3, w: 0.1, h: 0.1 }, '  Gnu  ', newId);
		expect(out.boxes).toHaveLength(before.boxes.length + 1);
		expect(out.boxes.slice(0, -1)).toEqual(before.boxes);
		expect(out.boxes.at(-1)).toEqual({
			id: issued[0],
			x: 0.2,
			y: 0.3,
			w: 0.1,
			h: 0.1,
			label: 'Gnu'
		});
		expect(issued).toHaveLength(1);
	});

	it('clamps the rectangle onto the image', () => {
		const out = addBox(payload(), { x: 0.95, y: -0.2, w: 0.2, h: 0.01 }, 'Gnu', idSource().newId);
		const added = out.boxes.at(-1) as FractionBox;
		inBounds(added);
	});

	it('allows an empty label (it is named next)', () => {
		const out = addBox(payload(), { x: 0.2, y: 0.3, w: 0.1, h: 0.1 }, '   ', idSource().newId);
		expect(out.boxes.at(-1)?.label).toBe('');
	});

	it('leaves the unplaced labels alone and does not change its input', () => {
		const before = payload();
		const copy = structuredClone(before);
		const out = addBox(before, { x: 0.2, y: 0.3, w: 0.1, h: 0.1 }, 'Gnu', idSource().newId);
		expect(out.unplaced).toEqual(['Walrus', 'Vole']);
		expect(before).toEqual(copy);
	});

	it('works on an empty image', () => {
		const out = addBox({ boxes: [] }, { x: 0, y: 0, w: 0.5, h: 0.5 }, 'A', idSource().newId);
		expect(out.boxes).toHaveLength(1);
	});
});

describe('placeLabel: the tap alternative for an unplaced label', () => {
	it('adds a box of OCCLUSION_NEW_BOX size centred on the point, with the label and a new ID', () => {
		const { newId, issued } = idSource();
		const out = placeLabel(payload(), 'Walrus', { x: 0.5, y: 0.4 }, newId);
		const box = out.boxes.at(-1);
		expect(out.boxes).toHaveLength(4);
		expect(box?.id).toBe(issued[0]);
		expect(box?.label).toBe('Walrus');
		expect(box?.w).toBeCloseTo(OCCLUSION_NEW_BOX.w, 9);
		expect(box?.h).toBeCloseTo(OCCLUSION_NEW_BOX.h, 9);
		expect((box?.x ?? 0) + (box?.w ?? 0) / 2).toBeCloseTo(0.5, 9);
		expect((box?.y ?? 0) + (box?.h ?? 0) / 2).toBeCloseTo(0.4, 9);
	});

	it('takes the label out of unplaced', () => {
		const out = placeLabel(payload(), 'Walrus', { x: 0.5, y: 0.4 }, idSource().newId);
		expect(out.unplaced).toEqual(['Vole']);
	});

	it('removes the first occurrence only when a label is listed twice', () => {
		const twice = { ...payload(), unplaced: ['A', 'B', 'A'] };
		const out = placeLabel(twice, 'A', { x: 0.5, y: 0.5 }, idSource().newId);
		expect(out.unplaced).toEqual(['B', 'A']);
	});

	it('clamps a box placed at a corner onto the image, keeping its size', () => {
		const { newId } = idSource();
		for (const at of [
			{ x: 0, y: 0 },
			{ x: 1, y: 1 },
			{ x: 0, y: 1 },
			{ x: 1, y: 0 }
		]) {
			const box = placeLabel(payload(), 'Vole', at, newId).boxes.at(-1) as FractionBox;
			inBounds(box);
			expect(box.w).toBeCloseTo(OCCLUSION_NEW_BOX.w, 9);
			expect(box.h).toBeCloseTo(OCCLUSION_NEW_BOX.h, 9);
		}
	});

	it('changes nothing for an unknown label and does not ask for an ID', () => {
		const { newId, issued } = idSource();
		const before = payload();
		const out = placeLabel(before, 'Nope', { x: 0.5, y: 0.5 }, newId);
		expect(out).toEqual(before);
		expect(issued).toEqual([]);
	});

	it('leaves no unplaced label behind once the last is placed', () => {
		// SPEC-GAP: whether `unplaced` becomes [] or is dropped; either reads as "none left".
		const one = { boxes: [], unplaced: ['Only'] };
		const out = placeLabel(one, 'Only', { x: 0.5, y: 0.5 }, idSource().newId);
		expect(out.unplaced ?? []).toEqual([]);
		expect(out.boxes).toHaveLength(1);
	});

	it('does not change its input', () => {
		const before = payload();
		const copy = structuredClone(before);
		placeLabel(before, 'Walrus', { x: 0.5, y: 0.4 }, idSource().newId);
		expect(before).toEqual(copy);
	});
});

describe('moveBox', () => {
	it('moves a box by (dx, dy) and leaves its size, ID and label', () => {
		const out = moveBox(payload(), uuid(1), 0.1, 0.2);
		const box = boxById(out, uuid(1));
		expect(box?.x).toBeCloseTo(0.2, 9);
		expect(box?.y).toBeCloseTo(0.3, 9);
		expect(box?.w).toBeCloseTo(0.2, 9);
		expect(box?.h).toBeCloseTo(0.1, 9);
		expect(box?.label).toBe('Zebra');
	});

	it('leaves the other boxes, their order and the unplaced labels alone', () => {
		const before = payload();
		const out = moveBox(before, uuid(1), 0.1, 0.2);
		expect(out.boxes.map((b) => b.id)).toEqual(before.boxes.map((b) => b.id));
		expect(out.boxes.slice(1)).toEqual(before.boxes.slice(1));
		expect(out.unplaced).toEqual(before.unplaced);
	});

	it('clamps at the image edge without shrinking the box', () => {
		const out = moveBox(payload(), uuid(2), 5, -5);
		const box = boxById(out, uuid(2)) as FractionBox;
		inBounds(box);
		expect(box.x + box.w).toBeCloseTo(1, 9);
		expect(box.y).toBeCloseTo(0, 9);
		expect(box.w).toBeCloseTo(0.3, 9);
		expect(box.h).toBeCloseTo(0.2, 9);
	});

	it('changes nothing for an unknown ID', () => {
		const before = payload();
		expect(moveBox(before, uuid(99), 0.1, 0.1)).toEqual(before);
	});

	it('always leaves the box on the image (property)', () => {
		const d = fc.double({ min: -3, max: 3, noNaN: true });
		fc.assert(
			fc.property(d, d, (dx, dy) => {
				inBounds(boxById(moveBox(payload(), uuid(2), dx, dy), uuid(2)) as FractionBox);
			}),
			{ numRuns: NUM_RUNS }
		);
	});
});

describe('resizeBox', () => {
	it('grows or shrinks by (dw, dh) keeping the top-left corner', () => {
		const out = resizeBox(payload(), uuid(2), 0.1, -0.05);
		const box = boxById(out, uuid(2));
		expect(box?.x).toBeCloseTo(0.5, 9);
		expect(box?.y).toBeCloseTo(0.5, 9);
		expect(box?.w).toBeCloseTo(0.4, 9);
		expect(box?.h).toBeCloseTo(0.15, 9);
		expect(box?.label).toBe('Yak');
	});

	it('never goes below OCCLUSION_MIN_BOX', () => {
		const box = boxById(resizeBox(payload(), uuid(2), -5, -5), uuid(2)) as FractionBox;
		expect(box.w).toBe(OCCLUSION_MIN_BOX);
		expect(box.h).toBe(OCCLUSION_MIN_BOX);
	});

	it('never leaves the image when grown past its edge', () => {
		// SPEC-GAP: "keeping its top-left corner, then clamped" and clampBox moves rather than
		// shrinks; only the bounds are asserted here, not whether the corner stays.
		const box = boxById(resizeBox(payload(), uuid(2), 5, 5), uuid(2)) as FractionBox;
		inBounds(box);
	});

	it('changes nothing for an unknown ID, and leaves the other boxes alone', () => {
		const before = payload();
		expect(resizeBox(before, uuid(99), 0.1, 0.1)).toEqual(before);
		const out = resizeBox(before, uuid(2), 0.1, 0.1);
		expect(out.boxes.filter((b) => b.id !== uuid(2))).toEqual(
			before.boxes.filter((b) => b.id !== uuid(2))
		);
		expect(out.unplaced).toEqual(before.unplaced);
	});

	it('always leaves the box on the image at a legal size (property)', () => {
		const d = fc.double({ min: -3, max: 3, noNaN: true });
		fc.assert(
			fc.property(d, d, (dw, dh) => {
				inBounds(boxById(resizeBox(payload(), uuid(2), dw, dh), uuid(2)) as FractionBox);
			}),
			{ numRuns: NUM_RUNS }
		);
	});
});

describe('removeBox', () => {
	it('removes only that box; the others keep their IDs and order', () => {
		const before = payload();
		const out = removeBox(before, uuid(2));
		expect(out.boxes.map((b) => b.id)).toEqual([uuid(1), uuid(3)]);
		expect(out.boxes).toEqual(before.boxes.filter((b) => b.id !== uuid(2)));
	});

	it('leaves the unplaced labels alone', () => {
		expect(removeBox(payload(), uuid(2)).unplaced).toEqual(['Walrus', 'Vole']);
	});

	it('changes nothing for an unknown ID', () => {
		const before = payload();
		expect(removeBox(before, uuid(99))).toEqual(before);
	});

	it('does not change its input', () => {
		const before = payload();
		const copy = structuredClone(before);
		removeBox(before, uuid(2));
		expect(before).toEqual(copy);
	});
});
