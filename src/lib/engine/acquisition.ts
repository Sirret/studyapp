import {
	ACQ_STEP_REQUIRED,
	PRETEST_AUTOHIDE_SKIPS,
	PRETEST_MAX,
	SPLIT_THRESHOLD
} from '#lib/config/defaults.ts';
import type {
	CardId,
	ChunkId,
	ExerciseKind,
	Placement,
	Priority,
	TopicId
} from '#lib/db/schemas/common.ts';
import type { NoteType } from '#lib/db/schemas/note.ts';
import { attemptMinutes, p0For, readMinutes, withMargin, type Calibration } from './estimate.ts';
import { compareText } from './replay.ts';
import type { Traced } from './trace.ts';

/**
 * Acquisition mode (learning from cold): units of study, their order, the steps of each unit,
 * its cost, the split flag and the full/quick path choice.
 *
 * @see BUILD_PLAN §6.7, CONCEPT §8 and Decisions log (Phase 7: acquisition units)
 */

export type AcquisitionPath = 'full' | 'quick';

export interface AcqTopic {
	id: TopicId;
	order: number;
	priority: Priority;
	placement: Placement;
}

export interface AcqChunk {
	id: ChunkId;
	topicId: TopicId;
	order: number;
	words: number;
	reported?: true;
}

/** A live card with what acquisition reads of it and its note. */
export interface AcqCard {
	id: CardId;
	topicId: TopicId;
	/** The note's chunk; absent when the note belongs to no chunk. */
	chunkId?: ChunkId;
	noteType: NoteType;
	path: readonly ExerciseKind[];
	/** The kind the card shows now (`currentKind`). */
	kind: ExerciseKind;
}

/** What one unit studies: a chunk's cards, or a topic's cards that belong to no chunk. */
export interface AcqUnit {
	/** `chunk:<chunkId>` or `topic:<topicId>`. */
	key: string;
	topicId: TopicId;
	chunkId: ChunkId | null;
	words: number;
	/** In the order the cards were given. */
	cardIds: CardId[];
}

/** One step of a unit, in the order they run. */
export type AcqStep =
	| { step: 'pretrain'; cardIds: CardId[] }
	| { step: 'pretest'; cardIds: CardId[] }
	| { step: 'read'; chunkId: ChunkId }
	| { step: 'quiz'; cards: { id: CardId; kind: ExerciseKind }[] };

/** Recall formats the chunk quiz prefers, in order. @see BUILD_PLAN §6.7 */
const QUIZ_RECALL_KINDS: readonly ExerciseKind[] = ['cloze', 'sequence'];
/** Note types whose cards can be pretested, in the order they are drawn. */
const PRETEST_TYPES: readonly NoteType[] = ['fact', 'cloze'];

function topicRank(a: AcqTopic, b: AcqTopic): number {
	const high = (topic: AcqTopic): number => (topic.priority === 'high' ? 0 : 1);
	return high(a) - high(b) || a.order - b.order || compareText(a.id, b.id);
}

/** One topic's units: its chunks in order, then its chunk-less cards. */
function topicUnits(
	topic: AcqTopic,
	chunks: readonly AcqChunk[],
	cards: readonly AcqCard[]
): AcqUnit[] {
	const own = cards.filter((card) => card.topicId === topic.id);
	const units: AcqUnit[] = chunks
		.filter((chunk) => chunk.topicId === topic.id && chunk.reported !== true)
		.sort((a, b) => a.order - b.order || compareText(a.id, b.id))
		.map((chunk) => ({
			key: `chunk:${chunk.id}`,
			topicId: topic.id,
			chunkId: chunk.id,
			words: chunk.words,
			cardIds: own.filter((card) => card.chunkId === chunk.id).map((card) => card.id)
		}));
	const known = new Set(chunks.map((chunk) => chunk.id));
	const loose = own.filter((card) => card.chunkId === undefined || !known.has(card.chunkId));
	units.push({
		key: `topic:${topic.id}`,
		topicId: topic.id,
		chunkId: null,
		words: 0,
		cardIds: loose.map((card) => card.id)
	});
	return units.filter((unit) => unit.cardIds.length > 0);
}

/**
 * The units of a course's unread topics, in study order. Depth: high-priority topics first, then
 * topic order, then chunk order, each topic's chunk-less unit after its chunks. Breadth: the first
 * unit of every high-priority topic first (in depth order), then the rest in depth order. Reported
 * chunks and units with no cards are left out.
 */
export function acquisitionUnits(input: {
	topics: readonly AcqTopic[];
	chunks: readonly AcqChunk[];
	cards: readonly AcqCard[];
	breadth: boolean;
}): Traced<AcqUnit[]> {
	const perTopic = input.topics
		.filter((topic) => topic.placement === 'unread')
		.sort(topicRank)
		.map((topic) => ({ topic, units: topicUnits(topic, input.chunks, input.cards) }));
	const depth = perTopic.flatMap((entry) => entry.units);
	let result = depth;
	if (input.breadth) {
		const first = perTopic
			.filter((entry) => entry.topic.priority === 'high')
			.flatMap((entry) => entry.units.slice(0, 1));
		const firstKeys = new Set(first.map((unit) => unit.key));
		result = [...first, ...depth.filter((unit) => !firstKeys.has(unit.key))];
	}
	return {
		result,
		trace: [{ rule: 'acquisition.units', breadth: input.breadth, units: result.map((u) => u.key) }]
	};
}

/** A quiz card's kind: `cloze` if on its path, else `sequence` if on it, else its current kind. */
export function quizKind(card: Pick<AcqCard, 'path' | 'kind'>): ExerciseKind {
	return QUIZ_RECALL_KINDS.find((kind) => card.path.includes(kind)) ?? card.kind;
}

function pretestCards(cards: readonly AcqCard[]): CardId[] {
	return PRETEST_TYPES.flatMap((type) => cards.filter((card) => card.noteType === type))
		.slice(0, PRETEST_MAX)
		.map((card) => card.id);
}

function quizCards(cards: readonly AcqCard[]): { id: CardId; kind: ExerciseKind }[] {
	const quiz = cards.map((card) => ({ id: card.id, kind: quizKind(card) }));
	const recall = quiz.filter((item) => QUIZ_RECALL_KINDS.includes(item.kind));
	return [...recall, ...quiz.filter((item) => !QUIZ_RECALL_KINDS.includes(item.kind))];
}

/**
 * A unit's steps: pretrain (its `keyterm` cards, if any) → pretest (full path with the pretest on:
 * up to `PRETEST_MAX` `fact` cards, then `cloze` cards, in card order; none → no step) → read (when
 * the unit has a chunk) → quiz (its other cards, `quizKind` each; recall-format cards first, then
 * the rest, each keeping card order; none → no step).
 */
export function unitSteps(input: {
	unit: AcqUnit;
	cards: readonly AcqCard[];
	path: AcquisitionPath;
	pretestOn: boolean;
}): Traced<AcqStep[]> {
	const byId = new Map(input.cards.map((card) => [card.id, card]));
	const own = input.unit.cardIds.flatMap((id) => byId.get(id) ?? []);
	const keyterms = own.filter((card) => card.noteType === 'keyterm');
	const others = own.filter((card) => card.noteType !== 'keyterm');
	const steps: AcqStep[] = [];
	if (keyterms.length > 0)
		steps.push({ step: 'pretrain', cardIds: keyterms.map((card) => card.id) });
	const pretest = input.path === 'full' && input.pretestOn ? pretestCards(others) : [];
	if (pretest.length > 0) steps.push({ step: 'pretest', cardIds: pretest });
	if (input.unit.chunkId !== null) steps.push({ step: 'read', chunkId: input.unit.chunkId });
	const quiz = quizCards(others);
	if (quiz.length > 0) steps.push({ step: 'quiz', cards: quiz });
	return {
		result: steps,
		trace: [{ rule: 'acquisition.steps', unit: input.unit.key, steps: steps.map((s) => s.step) }]
	};
}

function stepMinutes(step: AcqStep, byId: Map<CardId, AcqCard>, calibration: Calibration): number {
	const cost = (
		id: CardId,
		kind: ExerciseKind | null,
		attempts: (card: AcqCard) => number
	): number => {
		const card = byId.get(id);
		return card ? attemptMinutes(attempts(card), kind ?? card.kind, calibration) : 0;
	};
	const toCriterion = (card: AcqCard): number =>
		ACQ_STEP_REQUIRED / p0For(card.noteType, calibration);
	switch (step.step) {
		case 'pretrain':
			return step.cardIds.reduce((sum, id) => sum + cost(id, null, toCriterion), 0);
		case 'pretest':
			return step.cardIds.reduce((sum, id) => sum + cost(id, 'pretest', () => 1), 0);
		case 'read':
			return 0;
		case 'quiz':
			return step.cards.reduce((sum, item) => sum + cost(item.id, item.kind, toCriterion), 0);
	}
}

/**
 * A unit's cost before it starts: reading minutes plus `ACQ_STEP_REQUIRED / p0` attempts per
 * pretrain and quiz card and one per pretest card, at each card's seconds per attempt, with the
 * safety margin; and the number of steps.
 */
export function unitCost(input: {
	steps: readonly AcqStep[];
	cards: readonly AcqCard[];
	words: number;
	calibration: Calibration;
}): { minutes: number; steps: number } {
	const byId = new Map(input.cards.map((card) => [card.id, card]));
	const work = input.steps.reduce(
		(sum, step) => sum + stepMinutes(step, byId, input.calibration),
		0
	);
	const reading = input.steps.some((step) => step.step === 'read') ? readMinutes(input.words) : 0;
	return { minutes: withMargin(work + reading), steps: input.steps.length };
}

/** Whether the pretest still shows: fewer than `PRETEST_AUTOHIDE_SKIPS` skips this session. */
export function pretestVisible(skips: number): boolean {
	return skips < PRETEST_AUTOHIDE_SKIPS;
}

function accuracyBelow(attempts: readonly { correct: boolean }[]): boolean {
	if (attempts.length === 0) return false;
	const correct = attempts.filter((attempt) => attempt.correct).length;
	return correct / attempts.length < SPLIT_THRESHOLD;
}

/** The split flag: first-attempt accuracy on the chunk quiz below `SPLIT_THRESHOLD` (none → no). */
export function splitFlagFor(firstAttempts: readonly { correct: boolean }[]): boolean {
	return accuracyBelow(firstAttempts);
}

/** Prompt a split: the chunk is flagged and its next-day retest accuracy is still below threshold. */
export function shouldPromptSplit(
	flagged: boolean,
	retestFirstAttempts: readonly { correct: boolean }[]
): boolean {
	return flagged && accuracyBelow(retestFirstAttempts);
}

/** The path: the user's setting when `full` or `quick`; `auto` → full when feasible, else quick. */
export function choosePath(setting: 'auto' | AcquisitionPath, feasible: boolean): AcquisitionPath {
	if (setting !== 'auto') return setting;
	return feasible ? 'full' : 'quick';
}
