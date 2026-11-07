import { BANK_SIZE, FIRST_LETTER_LENGTH_DELTA, MC_OPTIONS } from '#lib/config/defaults.ts';
import type { CardId } from '#lib/db/schemas/common.ts';
import type { ReviewEvent } from '#lib/db/schemas/event.ts';
import type { AnswerEntry } from './answers.ts';
import { normalizeAnswer, textLength } from './grading.ts';
import { compareText } from './replay.ts';
import { shuffle, type Rng } from './rng.ts';
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

/** A candidate option with what ranking reads. */
interface Ranked {
	entry: AnswerEntry;
	normalized: string;
	tier: number;
	confusion: number;
	lengthGap: number;
}

/** Distractor tiers, filled in this order. @see BUILD_PLAN §6.11 */
const TIER_SIBLING = 0;
const TIER_TOPIC = 1;
const TIER_COURSE = 2;

/** The other card in a confusion pair with the target, or null. */
function confusedWith(
	{ cardId, chosenFromCardId }: Pick<ReviewEvent, 'cardId' | 'chosenFromCardId'>,
	target: CardId
): CardId | null {
	if (chosenFromCardId === undefined || cardId === chosenFromCardId) return null;
	if (cardId === target) return chosenFromCardId;
	return chosenFromCardId === target ? cardId : null;
}

/**
 * How often each other card was confused with the target: review events whose
 * `chosenFromCardId` pairs the two, in either direction.
 *
 * @see BUILD_PLAN §6.11 and Decisions log (distractor tiers)
 */
export function confusionCounts(
	events: readonly Pick<ReviewEvent, 'cardId' | 'chosenFromCardId'>[],
	targetCardId: CardId
): Map<CardId, number> {
	const counts = new Map<CardId, number>();
	for (const event of events) {
		const other = confusedWith(event, targetCardId);
		if (other !== null) counts.set(other, (counts.get(other) ?? 0) + 1);
	}
	return counts;
}

function tierOf(target: AnswerEntry, entry: AnswerEntry): number {
	const sibling = target.group !== undefined && entry.group === target.group;
	if (sibling || entry.tags.some((tag) => target.tags.includes(tag))) return TIER_SIBLING;
	return entry.topicId === target.topicId ? TIER_TOPIC : TIER_COURSE;
}

function compareRanked(a: Ranked, b: Ranked): number {
	return (
		a.tier - b.tier ||
		b.confusion - a.confusion ||
		a.lengthGap - b.lengthGap ||
		compareText(a.entry.cardId, b.entry.cardId)
	);
}

/** Eligible options, best first, one per normalised text. Tiers apply only when `useTiers`. */
function rankCandidates(input: ChoiceInput, useTiers: boolean): Ranked[] {
	const { target } = input;
	const answer = normalizeAnswer(target.text);
	const excluded = new Set([answer, ...input.accepted.map(normalizeAnswer)]);
	const ranked = input.pool
		.filter((entry) => entry.cardId !== target.cardId && entry.kind === target.kind)
		.map((entry): Ranked => {
			const normalized = normalizeAnswer(entry.text);
			return {
				entry,
				normalized,
				tier: useTiers ? tierOf(target, entry) : TIER_SIBLING,
				confusion: input.confusions.get(entry.cardId) ?? 0,
				lengthGap: Math.abs(textLength(normalized) - textLength(answer))
			};
		})
		.filter((candidate) => candidate.normalized !== '' && !excluded.has(candidate.normalized))
		.sort(compareRanked);
	const seen = new Set<string>();
	return ranked.filter((candidate) => {
		if (seen.has(candidate.normalized)) return false;
		seen.add(candidate.normalized);
		return true;
	});
}

/** The target plus the chosen entries, in seeded order. */
function choiceSet(target: AnswerEntry, chosen: readonly Ranked[], rng: Rng): ChoiceSet {
	const entries = [target, ...chosen.map((candidate) => candidate.entry)];
	const options = shuffle(
		entries.map((entry) => ({ text: entry.text, cardId: entry.cardId })),
		rng
	);
	return { options, correctIndex: options.findIndex((o) => o.cardId === target.cardId) };
}

/**
 * Up to `MC_OPTIONS − 1` distractors plus the answer, in seeded order.
 *
 * @see BUILD_PLAN §6.11 and Decisions log (distractor tiers)
 */
export function pickDistractors(input: ChoiceInput): Traced<ChoiceSet> {
	const wanted = MC_OPTIONS - 1;
	const chosen = rankCandidates(input, true).slice(0, wanted);
	const picks = chosen.map(({ entry, tier, confusion }) => ({
		cardId: entry.cardId,
		tier,
		confusion
	}));
	return {
		result: choiceSet(input.target, chosen, input.rng),
		trace: [{ rule: 'distractors', wanted, picks }]
	};
}

/**
 * The first-letter showing after a missed typed answer.
 *
 * @see BUILD_PLAN §6.10 (first-letter mode) and Decisions log
 */
export function firstLetterBank(input: ChoiceInput): Traced<FirstLetterBank> {
	const answer = normalizeAnswer(input.target.text);
	const letter = [...answer][0] ?? '';
	const length = textLength(answer);
	const candidates = rankCandidates(input, false).filter(
		(candidate) =>
			[...candidate.normalized][0] === letter &&
			Math.abs(textLength(candidate.normalized) - length) <= FIRST_LETTER_LENGTH_DELTA
	);
	const wanted = BANK_SIZE - 1;
	const enough = letter !== '' && candidates.length >= wanted;
	const bank = enough ? choiceSet(input.target, candidates.slice(0, wanted), input.rng) : null;
	const rule = enough ? 'first-letter-bank' : 'first-letter-type';
	return { result: { letter, bank }, trace: [{ rule, letter, candidates: candidates.length }] };
}
