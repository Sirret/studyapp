import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { NoteContent } from '#lib/engine/cardgen.ts';
import { checkResponse, type ExerciseResponse } from '#lib/engine/exercise-check.ts';
import { checkConnect, checkPlace } from '#lib/engine/exercise-check-figure.ts';
import type { ConnectSpec, PlaceSpec } from '#lib/engine/exercise-spec.ts';
import { asShape, build, buildCourse } from './exercise-fixtures.ts';
import { cardId, mediaId, NUM_RUNS, uuid } from './fixtures.ts';

type PlaceResponse = Extract<ExerciseResponse, { shape: 'place' }>;
type ConnectResponse = Extract<ExerciseResponse, { shape: 'connect' }>;

// ---------------------------------------------------------------------------------------------
// place (occlusionDrag)
// ---------------------------------------------------------------------------------------------

// Dyadic fractions, so that fraction × size is exact in floating point at every size below.
const ASKED = { id: uuid(0x11), x: 0.25, y: 0.5, w: 0.25, h: 0.25 };
const OVERLAPPING = { id: uuid(0x12), x: 0.375, y: 0.5625, w: 0.25, h: 0.25 };
const FAR = { id: uuid(0x13), x: 0.75, y: 0.0, w: 0.125, h: 0.125 };
const SIZES = [
	{ width: 500, height: 400 },
	{ width: 360, height: 240 },
	{ width: 1024, height: 768 },
	{ width: 320, height: 1280 }
] as const;

const PLACE: PlaceSpec = {
	shape: 'place',
	kind: 'occlusionDrag',
	cardId: cardId(1),
	prompt: 'Zebra',
	instruction: 'Place it',
	figure: {
		kind: 'occlusion',
		mediaId: mediaId(1),
		title: 'Image',
		boxes: [ASKED, OVERLAPPING, FAR].map(({ id, x, y, w, h }) => ({ id, x, y, w, h })),
		covered: [ASKED.id, OVERLAPPING.id, FAR.id],
		target: null
	},
	label: 'Zebra',
	boxId: ASKED.id
};

const drop = (x: number, y: number, size: (typeof SIZES)[number]): PlaceResponse => ({
	shape: 'place',
	at: { point: { x, y }, size }
});
const tap = (boxId: string): PlaceResponse => ({ shape: 'place', at: { boxId } });

describe('checkPlace: a drop point is graded by the hit test (BUILD_PLAN §7.1, §6.10)', () => {
	describe.each(SIZES)('at a rendered size of $width × $height', (size) => {
		const left = ASKED.x * size.width;
		const top = ASKED.y * size.height;
		const right = (ASKED.x + ASKED.w) * size.width;
		const bottom = (ASKED.y + ASKED.h) * size.height;

		it('is correct inside the box', () => {
			expect(checkPlace(PLACE, drop((left + right) / 2, (top + bottom) / 2, size)).correct).toBe(
				true
			);
		});

		it('is correct exactly on every edge and corner (edges count as inside)', () => {
			const midX = (left + right) / 2;
			const midY = (top + bottom) / 2;
			const points = [
				[left, top],
				[right, top],
				[left, bottom],
				[right, bottom],
				[left, midY],
				[right, midY],
				[midX, top],
				[midX, bottom]
			] as const;
			for (const [x, y] of points) expect(checkPlace(PLACE, drop(x, y, size)).correct).toBe(true);
		});

		it('is wrong one pixel outside any side', () => {
			const midX = (left + right) / 2;
			const midY = (top + bottom) / 2;
			const points = [
				[left - 1, midY],
				[right + 1, midY],
				[midX, top - 1],
				[midX, bottom + 1]
			] as const;
			for (const [x, y] of points) {
				// Keep clear of the overlapping box, which is not the asked one.
				const verdict = checkPlace(PLACE, drop(x, y, size));
				expect(verdict.correct).toBe(false);
			}
		});

		it('is wrong far outside, with no box chosen', () => {
			const verdict = checkPlace(PLACE, drop(1, 1, size));
			expect(verdict.correct).toBe(false);
			expect(verdict.chosen).toBeUndefined();
		});
	});

	it('reveals the label and has no marks, right or wrong', () => {
		const right = checkPlace(PLACE, tap(ASKED.id));
		const wrong = checkPlace(PLACE, tap(FAR.id));
		for (const verdict of [right, wrong]) {
			expect(verdict.reveal).toEqual(['Zebra']);
			expect(verdict.marks).toEqual([]);
		}
	});

	it('names the hit box as chosen when the drop is right', () => {
		expect(checkPlace(PLACE, drop(150, 220, SIZES[0])).chosen).toBe(ASKED.id);
	});

	it('counts a point inside several boxes as the asked one when it is inside the asked box', () => {
		// Inside both ASKED (0.25–0.5, 0.5–0.75) and OVERLAPPING (0.375–0.625, 0.5625–0.8125).
		const size = SIZES[0];
		const point = drop(0.4 * size.width, 0.6 * size.height, size);
		expect(checkPlace(PLACE, point).correct).toBe(true);
	});

	it('is wrong inside another box only', () => {
		const size = SIZES[0];
		const verdict = checkPlace(PLACE, drop(0.6 * size.width, 0.8 * size.height, size));
		expect(verdict.correct).toBe(false);
		// SPEC-GAP: "chosen = the tapped or hit box's id (none for a miss)": a drop inside another
		// box is read as a hit on that box.
		expect(verdict.chosen).toBe(OVERLAPPING.id);
	});

	it('is correct iff the point lies in the box, for any point and size', () => {
		fc.assert(
			fc.property(
				fc.constantFrom(...SIZES),
				fc.double({ min: -0.25, max: 1.25, noNaN: true }),
				fc.double({ min: -0.25, max: 1.25, noNaN: true }),
				(size, fx, fy) => {
					const x = fx * size.width;
					const y = fy * size.height;
					const inside =
						x >= ASKED.x * size.width &&
						x <= (ASKED.x + ASKED.w) * size.width &&
						y >= ASKED.y * size.height &&
						y <= (ASKED.y + ASKED.h) * size.height;
					expect(checkPlace(PLACE, drop(x, y, size)).correct).toBe(inside);
				}
			),
			{ numRuns: NUM_RUNS }
		);
	});
});

describe('checkPlace: tapping a box gives the same verdict as dragging onto it', () => {
	it('is correct for the asked box and wrong for any other, with the tapped id as chosen', () => {
		expect(checkPlace(PLACE, tap(ASKED.id))).toMatchObject({ correct: true, chosen: ASKED.id });
		expect(checkPlace(PLACE, tap(OVERLAPPING.id))).toMatchObject({
			correct: false,
			chosen: OVERLAPPING.id
		});
		expect(checkPlace(PLACE, tap(FAR.id))).toMatchObject({ correct: false, chosen: FAR.id });
	});

	it('equals a drop on that box’s centre, for every box and size', () => {
		for (const size of SIZES) {
			for (const box of PLACE.figure.boxes) {
				const centre = drop(
					(box.x + box.w / 2) * size.width,
					(box.y + box.h / 2) * size.height,
					size
				);
				// The OVERLAPPING box's centre also lies in ASKED? No: check by value instead of assuming.
				const inAsked =
					box.id === ASKED.id ||
					(box.x + box.w / 2 >= ASKED.x &&
						box.x + box.w / 2 <= ASKED.x + ASKED.w &&
						box.y + box.h / 2 >= ASKED.y &&
						box.y + box.h / 2 <= ASKED.y + ASKED.h);
				expect(checkPlace(PLACE, centre).correct).toBe(inAsked);
			}
		}
		for (const box of PLACE.figure.boxes) {
			expect(checkPlace(PLACE, tap(box.id)).correct).toBe(box.id === ASKED.id);
		}
	});

	it('is wrong for a box id that is not on the image', () => {
		expect(checkPlace(PLACE, tap(uuid(0xdead))).correct).toBe(false);
	});
});

describe('place through buildExercise and checkResponse', () => {
	const labels = ['Zebra', 'Yak', 'Walrus'];
	const note: NoteContent = {
		type: 'occlusion',
		payload: {
			mediaId: mediaId(7),
			boxes: labels.map((label, i) => ({
				id: uuid(0x100 + i),
				x: i * 0.25,
				y: 0.25,
				w: 0.125,
				h: 0.125,
				label
			}))
		}
	};
	const course = buildCourse([{ content: note }]);
	const spec = () =>
		asShape(build(course, 1, `box:${uuid(0x101)}`, 'occlusionDrag').result, 'place');

	it('checkResponse of a place spec equals checkPlace', () => {
		const built = spec();
		const response = tap(built.boxId);
		expect(checkResponse(built, response).result).toEqual(checkPlace(built, response));
	});

	it('is right when dropped on the asked box of the built spec, wrong on another', () => {
		const built = spec();
		const size = { width: 400, height: 300 };
		const target = built.figure.boxes.find((b) => b.id === built.boxId);
		const other = built.figure.boxes.find((b) => b.id !== built.boxId);
		if (!target || !other) throw new Error('fixture: boxes missing');
		const centre = (b: typeof target) => ({
			x: (b.x + b.w / 2) * size.width,
			y: (b.y + b.h / 2) * size.height
		});
		const right = checkResponse(built, { shape: 'place', at: { point: centre(target), size } });
		const wrong = checkResponse(built, { shape: 'place', at: { point: centre(other), size } });
		expect(right.result.correct).toBe(true);
		expect(wrong.result.correct).toBe(false);
		expect(right.trace).toEqual([
			expect.objectContaining({ rule: 'exercise.check', shape: 'place', correct: true })
		]);
	});

	it('reveals the asked label', () => {
		const built = spec();
		expect(checkResponse(built, tap(built.boxId)).result.reveal).toEqual(['Yak']);
	});
});

// ---------------------------------------------------------------------------------------------
// connect (structureRebuild)
// ---------------------------------------------------------------------------------------------

const NA = uuid(0x21);
const NB = uuid(0x22);
const NC = uuid(0x23);

const CONNECT: ConnectSpec = {
	shape: 'connect',
	kind: 'structureRebuild',
	cardId: cardId(2),
	prompt: 'Handshake',
	instruction: 'Connect',
	figure: {
		kind: 'diagram',
		shape: 'flow',
		title: 'Handshake',
		nodes: [
			{ id: NA, label: 'Alpha' },
			{ id: NB, label: 'Beta' },
			{ id: NC, label: 'Gamma' }
		],
		edges: [],
		target: null,
		layout: null
	},
	edges: [
		{ from: NA, to: NB },
		{ from: NB, to: NC }
	]
};
const connect = (...edges: [string, string][]): ConnectResponse => ({
	shape: 'connect',
	edges: edges.map(([from, to]) => ({ from, to }))
});

describe('checkConnect: graded as a set on from → to (BUILD_PLAN §7.2, §6.10)', () => {
	it('is correct when the arrows are exactly the reference', () => {
		const verdict = checkConnect(CONNECT, connect([NA, NB], [NB, NC]));
		expect(verdict.correct).toBe(true);
		expect(verdict.marks).toEqual([]);
	});

	it('ignores the order the arrows were drawn in', () => {
		expect(checkConnect(CONNECT, connect([NB, NC], [NA, NB])).correct).toBe(true);
	});

	it('is wrong with an arrow missing, and marks nothing (no extra arrow)', () => {
		const verdict = checkConnect(CONNECT, connect([NA, NB]));
		expect(verdict.correct).toBe(false);
		expect(verdict.marks).toEqual([]);
	});

	it('is wrong with no arrows at all', () => {
		const verdict = checkConnect(CONNECT, connect());
		expect(verdict.correct).toBe(false);
		expect(verdict.marks).toEqual([]);
	});

	it('is wrong with an extra arrow, and marks its index in the response', () => {
		const verdict = checkConnect(CONNECT, connect([NA, NB], [NC, NA], [NB, NC]));
		expect(verdict.correct).toBe(false);
		expect(verdict.marks).toEqual([1]);
	});

	it('marks every extra arrow', () => {
		const verdict = checkConnect(CONNECT, connect([NC, NA], [NA, NB], [NB, NC], [NA, NC]));
		expect(verdict.marks).toEqual([0, 3]);
	});

	it('cares about direction: a reversed arrow is both missing and extra', () => {
		const verdict = checkConnect(CONNECT, connect([NB, NA], [NB, NC]));
		expect(verdict.correct).toBe(false);
		expect(verdict.marks).toEqual([0]);
	});

	it('counts a repeated arrow once', () => {
		const verdict = checkConnect(CONNECT, connect([NA, NB], [NA, NB], [NB, NC]));
		expect(verdict.correct).toBe(true);
		expect(verdict.marks).toEqual([]);
	});

	it('reveals one "A → B" line per reference arrow, with node labels, in reference order', () => {
		const verdict = checkConnect(CONNECT, connect());
		expect(verdict.reveal).toEqual(['Alpha → Beta', 'Beta → Gamma']);
		expect(checkConnect(CONNECT, connect([NB, NC], [NA, NB])).reveal).toEqual([
			'Alpha → Beta',
			'Beta → Gamma'
		]);
	});

	it('is correct for any permutation of the reference arrows, and wrong for any dropped one', () => {
		fc.assert(
			fc.property(fc.shuffledSubarray(CONNECT.edges, { minLength: 0 }), (edges) => {
				const response: ConnectResponse = { shape: 'connect', edges };
				expect(checkConnect(CONNECT, response).correct).toBe(edges.length === CONNECT.edges.length);
			}),
			{ numRuns: NUM_RUNS }
		);
	});
});

describe('connect through buildExercise and checkResponse', () => {
	const note: NoteContent = {
		type: 'diagram',
		payload: {
			kind: 'flow',
			name: 'Handshake',
			nodes: [
				{ id: NA, label: 'Client' },
				{ id: NB, label: 'Server' },
				{ id: NC, label: 'Database' }
			],
			edges: [
				{ id: uuid(0x31), from: NA, to: NB, label: 'request' },
				{ id: uuid(0x32), from: NB, to: NC }
			]
		}
	};
	const course = buildCourse([{ content: note }]);
	const spec = () => asShape(build(course, 1, 'rebuild', 'structureRebuild').result, 'connect');

	it('grades from → to only: arrow labels are not asked', () => {
		const built = spec();
		const response: ConnectResponse = { shape: 'connect', edges: [...built.edges] };
		expect(checkResponse(built, response).result.correct).toBe(true);
	});

	it('is wrong when an arrow is drawn the other way round', () => {
		const built = spec();
		const reversed: ConnectResponse = {
			shape: 'connect',
			edges: built.edges.map((e) => ({ from: e.to, to: e.from }))
		};
		const { result, trace } = checkResponse(built, reversed);
		expect(result.correct).toBe(false);
		expect(result.marks).toEqual([0, 1]);
		expect(trace[0]).toMatchObject({ rule: 'exercise.check', shape: 'connect', correct: false });
	});

	it('checkResponse equals checkConnect', () => {
		const built = spec();
		const response: ConnectResponse = { shape: 'connect', edges: [] };
		expect(checkResponse(built, response).result).toEqual(checkConnect(built, response));
	});
});

describe('layerOrder through buildExercise and checkResponse (sequence grading)', () => {
	const labels = ['Application', 'Transport', 'Network', 'Link'];
	const note: NoteContent = {
		type: 'diagram',
		payload: {
			kind: 'stack',
			name: 'Stack',
			nodes: labels.map((label, i) => ({ id: uuid(0x40 + i), label })),
			edges: []
		}
	};
	const course = buildCourse([{ content: note }]);
	it('is correct for the top-to-bottom order and marks the one layer moved out of place', () => {
		const spec = asShape(build(course, 1, 'layers', 'layerOrder').result, 'order');
		expect(checkResponse(spec, { shape: 'order', order: spec.correctOrder }).result.correct).toBe(
			true
		);
		const [first, ...rest] = spec.correctOrder;
		const moved = checkResponse(spec, { shape: 'order', order: [...rest, first as number] }).result;
		expect(moved.correct).toBe(false);
		expect(moved.marks).toEqual([first]);
	});
});
