import type { CardId } from '#lib/db/schemas/common.ts';
import type { ReviewEvent } from '#lib/db/schemas/event.ts';
import type { AnswerEntry } from './answers.ts';
import type { Rng } from './rng.ts';
import type { Traced } from './trace.ts';

/** One option shown to the student. */
export interface ChoiceOption {
	text: string;
	/** The card this text is the answer of. */
	cardId: CardId;
}

/** Shuffled options and where the correct one landed. */
export interface ChoiceSet {
	options: ChoiceOption[];
	correctIndex: number;
}

/** What option pickers need. `pool` may include the target itself; it is skipped. */
export interface ChoiceInput {
	target: AnswerEntry;
	/** The target note's accepted strings for this variant; never offered. */
	accepted: readonly string[];
	pool: readonly AnswerEntry[];
	/** Logged confusions between the target and each other card. */
	confusions: ReadonlyMap<CardId, number>;
	rng: Rng;
}

/** First-letter showing: the letter, and a bank, or null when typing is required. */
export interface FirstLetterBank {
	letter: string;
	bank: ChoiceSet | null;
}

/**
 * How often each other card was confused with the target: review events whose
 * `chosenFromCardId` pairs the two, in either direction.
 *
 * @see BUILD_PLAN §6.11 and Decisions log (distractor tiers)
 */
export function confusionCounts(
	_events: readonly Pick<ReviewEvent, 'cardId' | 'chosenFromCardId'>[],
	_targetCardId: CardId
): Map<CardId, number> {
	throw new Error('not implemented');
}

/**
 * Up to `MC_OPTIONS − 1` distractors plus the answer, in seeded order.
 *
 * @see BUILD_PLAN §6.11 and Decisions log (distractor tiers)
 */
export function pickDistractors(_input: ChoiceInput): Traced<ChoiceSet> {
	throw new Error('not implemented');
}

/**
 * The first-letter showing after a missed typed answer.
 *
 * @see BUILD_PLAN §6.10 (first-letter mode) and Decisions log
 */
export function firstLetterBank(_input: ChoiceInput): Traced<FirstLetterBank> {
	throw new Error('not implemented');
}
