import { describe, expect, it } from 'vitest';
import { ACQ_STEP_REQUIRED, P0, PRETEST_MAX } from '#lib/config/defaults.ts';
import type { CardId } from '#lib/db/schemas/common.ts';
import {
	unitCost,
	unitSteps,
	type AcqCard,
	type AcqStep,
	type AcqUnit
} from '#lib/engine/acquisition.ts';
import { readMinutes, withMargin } from '#lib/engine/estimate.ts';
import { uniformCalibration } from './cram-fixtures.ts';
import { cardId, chunkId, topicId } from './fixtures.ts';

/** @see BUILD_PLAN §6.7 (Steps, Pretest, Chunk quiz, Full vs quick path, cost), CONCEPT §8 */

const CHUNK = chunkId(100);
const card = (n: number, overrides: Partial<AcqCard> = {}): AcqCard => ({
	id: cardId(n),
	topicId: topicId(1),
	chunkId: CHUNK,
	noteType: 'cloze',
	path: ['cloze'],
	kind: 'cloze',
	...overrides
});
const unitOf = (cards: readonly AcqCard[], chunk: boolean = true): AcqUnit => ({
	key: chunk ? `chunk:${CHUNK}` : `topic:${topicId(1)}`,
	topicId: topicId(1),
	chunkId: chunk ? CHUNK : null,
	words: chunk ? 300 : 0,
	cardIds: cards.map((c) => c.id)
});
const stepsFor = (
	cards: readonly AcqCard[],
	path: 'full' | 'quick' = 'full',
	pretestOn = true,
	chunk = true
) => unitSteps({ unit: unitOf(cards, chunk), cards, path, pretestOn }).result;
const names = (steps: readonly AcqStep[]) => steps.map((s) => s.step);
const stepOf = <S extends AcqStep['step']>(steps: readonly AcqStep[], step: S) =>
	steps.find((s): s is Extract<AcqStep, { step: S }> => s.step === step);

const keyterm = (n: number) => card(n, { noteType: 'keyterm', path: ['mc', 'cloze'], kind: 'mc' });
const fact = (n: number) => card(n, { noteType: 'fact' });

describe('unitSteps: order and presence', () => {
	const deck = [keyterm(1), fact(2), card(3), keyterm(4)];

	it('runs pretrain → pretest → read → quiz on the full path with the pretest on', () => {
		expect(names(stepsFor(deck))).toStrictEqual(['pretrain', 'pretest', 'read', 'quiz']);
	});

	it('drops the pretest on the quick path', () => {
		expect(names(stepsFor(deck, 'quick'))).toStrictEqual(['pretrain', 'read', 'quiz']);
	});

	it('drops the pretest when the setting is off', () => {
		expect(names(stepsFor(deck, 'full', false))).toStrictEqual(['pretrain', 'read', 'quiz']);
	});

	it('reads the unit chunk', () => {
		expect(stepOf(stepsFor(deck), 'read')).toStrictEqual({ step: 'read', chunkId: CHUNK });
	});

	it('has no read step for a unit with no chunk', () => {
		expect(names(stepsFor(deck, 'full', true, false))).toStrictEqual([
			'pretrain',
			'pretest',
			'quiz'
		]);
	});

	it('leaves out an empty pretrain step', () => {
		expect(names(stepsFor([fact(2), card(3)]))).toStrictEqual(['pretest', 'read', 'quiz']);
	});

	it('leaves out an empty quiz step', () => {
		expect(names(stepsFor([keyterm(1)], 'quick', false, false))).toStrictEqual(['pretrain']);
	});

	it('leaves out the pretest when no fact or cloze card exists', () => {
		const seq = card(5, { noteType: 'sequence', path: ['sequence'], kind: 'sequence' });
		expect(names(stepsFor([keyterm(1), seq]))).toStrictEqual(['pretrain', 'read', 'quiz']);
	});

	it('only uses the unit own cards', () => {
		const other = card(9, { topicId: topicId(2) });
		const steps = unitSteps({
			unit: unitOf([card(3)]),
			cards: [card(3), other],
			path: 'quick',
			pretestOn: false
		}).result;
		expect(stepOf(steps, 'quiz')!.cards.map((c) => c.id)).toStrictEqual([cardId(3)]);
	});

	it('is deterministic, trace included', () => {
		const input = { unit: unitOf(deck), cards: deck, path: 'full' as const, pretestOn: true };
		expect(unitSteps(input)).toStrictEqual(unitSteps(input));
	});
});

describe('unitSteps: contents', () => {
	it('pre-trains the keyterm cards, in card order', () => {
		const steps = stepsFor([card(3), keyterm(4), keyterm(1)]);
		expect(stepOf(steps, 'pretrain')!.cardIds).toStrictEqual([cardId(4), cardId(1)]);
	});

	it('pretests up to PRETEST_MAX fact cards, then cloze cards, in card order', () => {
		// SPEC-GAP: "fact cards" / "cloze cards" read as cards of `fact` / `cloze` notes.
		const deck = [card(10), fact(11), card(12), fact(13)];
		const expected = [cardId(11), cardId(13), cardId(10), cardId(12)].slice(0, PRETEST_MAX);
		expect(stepOf(stepsFor(deck), 'pretest')!.cardIds).toStrictEqual(expected);
	});

	it('pretests no more than PRETEST_MAX cards', () => {
		const deck = Array.from({ length: PRETEST_MAX + 3 }, (_, i) => fact(20 + i));
		expect(stepOf(stepsFor(deck), 'pretest')!.cardIds).toHaveLength(PRETEST_MAX);
	});

	it('never pretests keyterm cards', () => {
		const pretest = stepOf(stepsFor([keyterm(1), fact(2)]), 'pretest')!;
		expect(pretest.cardIds).not.toContain(cardId(1));
	});

	it('quizzes the non-keyterm cards, pretested ones included', () => {
		// SPEC-GAP: "quiz (the other cards)" read as every card not pre-trained; a pretest is a
		// covert guess with no credit, so pretested cards still get quizzed.
		const steps = stepsFor([keyterm(1), fact(2), card(3)]);
		expect(
			stepOf(steps, 'quiz')!
				.cards.map((c) => c.id)
				.sort()
		).toStrictEqual([cardId(2), cardId(3)]);
	});

	it('quizzes each card in its quizKind', () => {
		const onlyMc = card(1, { path: ['mc', 'newInstance'], kind: 'mc' });
		const seq = card(2, { noteType: 'sequence', path: ['parsons', 'sequence'], kind: 'parsons' });
		const cloze = card(3, { path: ['mc', 'cloze'], kind: 'mc' });
		const quiz = stepOf(stepsFor([onlyMc, seq, cloze], 'quick'), 'quiz')!;
		const kindOf = (id: CardId) => quiz.cards.find((c) => c.id === id)?.kind;
		expect([kindOf(cardId(1)), kindOf(cardId(2)), kindOf(cardId(3))]).toStrictEqual([
			'mc',
			'sequence',
			'cloze'
		]);
	});

	it('puts recall-format cards first, then the rest, each keeping card order', () => {
		const mcA = card(1, { path: ['mc'], kind: 'mc' });
		const clozeB = card(2, { path: ['mc', 'cloze'], kind: 'mc' });
		const mcC = card(3, { path: ['mc'], kind: 'mc' });
		const seqD = card(4, { noteType: 'sequence', path: ['sequence'], kind: 'sequence' });
		const quiz = stepOf(stepsFor([mcA, clozeB, mcC, seqD], 'quick'), 'quiz')!;
		expect(quiz.cards.map((c) => c.id)).toStrictEqual([cardId(2), cardId(4), cardId(1), cardId(3)]);
	});
});

describe('unitCost', () => {
	const SEC = 30;
	const calibration = uniformCalibration(SEC);

	it('costs reading plus ACQ_STEP_REQUIRED / p0 attempts per pretrain and quiz card and one per pretest card, with the margin', () => {
		const deck = [keyterm(1), fact(2), card(3)];
		const steps = stepsFor(deck);
		const pretested = stepOf(steps, 'pretest')!.cardIds.length;
		const attempts =
			ACQ_STEP_REQUIRED / P0.fact +
			ACQ_STEP_REQUIRED / P0.fact +
			ACQ_STEP_REQUIRED / P0.concept +
			pretested;
		const expected = withMargin(readMinutes(300) + (attempts * SEC) / 60);
		const cost = unitCost({ steps, cards: deck, words: 300, calibration });
		expect(cost.minutes).toBeCloseTo(expected, 6);
		expect(cost.steps).toBe(steps.length);
	});

	it('counts the steps of a quick-path unit', () => {
		const deck = [keyterm(1), card(3)];
		const steps = stepsFor(deck, 'quick');
		expect(unitCost({ steps, cards: deck, words: 300, calibration }).steps).toBe(3);
	});

	it('costs reading only for a unit with no card steps', () => {
		const cost = unitCost({
			steps: [{ step: 'read', chunkId: CHUNK }],
			cards: [],
			words: 450,
			calibration
		});
		expect(cost).toStrictEqual({ minutes: withMargin(readMinutes(450)), steps: 1 });
	});

	it('costs nothing for no steps', () => {
		expect(unitCost({ steps: [], cards: [], words: 0, calibration })).toStrictEqual({
			minutes: 0,
			steps: 0
		});
	});
});
