import type { CardId, ExerciseKind, NoteId } from '#lib/db/schemas/common.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import type { AnswerNote } from './answers.ts';
import type { OtherAnswer } from './grading.ts';
import type { Rng } from './rng.ts';
import type { Traced } from './trace.ts';

/** What every exercise spec carries. @see BUILD_PLAN §5.1 */
interface SpecBase {
	/** The kind really shown (after any fallback); the event logs this. */
	kind: ExerciseKind;
	cardId: CardId;
	/** The question text. */
	prompt: string;
	/** One short line saying what to do, e.g. "Type the term". */
	instruction: string;
}

/** An option of a `choose` or `chooseMany` exercise. */
export interface SpecOption {
	text: string;
	/** The card this text is the answer of, when it came from another card. */
	cardId?: CardId;
	/** That card's prompt, for contrastive feedback ("that's the answer to …"). */
	answers?: string;
}

/** A checklist item of a self-rated exercise; `blurt` items name the card they stand for. */
export interface ChecklistItem {
	text: string;
	cardId?: CardId;
}

/** Typed recall. @see BUILD_PLAN §5.1 */
export interface TypeSpec extends SpecBase {
	shape: 'type';
	answer: string;
	accepted: string[];
	others: OtherAnswer[];
	/** The first letter, shown as a hint (`firstLetterType`), else null. */
	letter: string | null;
	/** Lines shown above the prompt (the worked steps of a `fadeStep`), else empty. */
	context: string[];
}

/** Pick one option. */
export interface ChooseSpec extends SpecBase {
	shape: 'choose';
	options: SpecOption[];
	correctIndex: number;
	/** The first letter (`firstLetterBank`), else null. */
	letter: string | null;
}

/** Pick every option that applies. */
export interface ChooseManySpec extends SpecBase {
	shape: 'chooseMany';
	options: SpecOption[];
	/** Correct option indexes, ascending. */
	correct: number[];
}

/** Put items in order, leaving out extras. */
export interface OrderSpec extends SpecBase {
	shape: 'order';
	/** Item texts in shuffled display order. */
	items: string[];
	/** Item indexes in the right order. */
	correctOrder: number[];
	/** Item indexes that don't belong (`parsons`); empty otherwise. */
	extras: number[];
}

/** Match each left entry to a right entry. */
export interface PairSpec extends SpecBase {
	shape: 'pair';
	left: string[];
	right: string[];
	/** The right index that belongs to each left entry. */
	pairs: number[];
}

/** Sort items into buckets. */
export interface SortSpec extends SpecBase {
	shape: 'sort';
	buckets: string[];
	items: string[];
	/** The bucket index of each item. */
	bucketOf: number[];
}

/** Recall, reveal, rate yourself; never graded. */
export interface SelfRateSpec extends SpecBase {
	shape: 'selfRate';
	answer: string;
	checklist: ChecklistItem[];
}

/** Study a worked example once; never graded. */
export interface StudySpec extends SpecBase {
	shape: 'study';
	steps: { subgoal: string; step: string }[];
}

/** What an exercise component renders. Discriminated on `shape`. @see BUILD_PLAN §5.1 */
export type ExerciseSpec =
	| TypeSpec
	| ChooseSpec
	| ChooseManySpec
	| OrderSpec
	| PairSpec
	| SortSpec
	| SelfRateSpec
	| StudySpec;

export type ExerciseShape = ExerciseSpec['shape'];

/** A card as the builder sees it. */
export interface ExerciseCard {
	id: CardId;
	noteId: NoteId;
	variant: string;
}

/** A note as the builder sees it. */
export type ExerciseNote = AnswerNote & Pick<Note, 'topicId' | 'tags' | 'order' | 'accept'>;

/** Everything `buildExercise` reads. */
export interface ExerciseInput {
	/** From `exerciseKindFor`. */
	kind: ExerciseKind;
	card: ExerciseCard & {
		path: readonly ExerciseKind[];
		/** The path index the shown kind came from (`currentStep`). */
		step: number;
	};
	/** The course's cards and notes, the card's own included; used for options and pools. */
	course: {
		cards: readonly ExerciseCard[];
		notes: ReadonlyMap<NoteId, ExerciseNote>;
	};
	/** Logged confusions between this card and others (`confusionCounts`). */
	confusions: ReadonlyMap<CardId, number>;
	/** `rngFor(cardId, sessionId, attempt)`. */
	rng: Rng;
}

/** What `exerciseKindFor` reads. */
export interface KindInput {
	path: readonly ExerciseKind[];
	pathStep: number;
	accuracy: { n: number; correct: number };
	spellingMode: 'fuzzy' | 'firstLetter';
	/** The card's previous review in this session was a wrong `type`-shape answer. */
	missedTyped: boolean;
}

/**
 * The kind to show: `currentKind`, except that a `cloze` step becomes `firstLetterBank` in
 * first-letter spelling mode or right after a missed typed answer.
 *
 * @see BUILD_PLAN §5.1 (choosing the kind) and §6.10 (first-letter mode)
 */
export function exerciseKindFor(input: KindInput): ExerciseKind {
	void input;
	throw new Error('not implemented');
}

/**
 * A card's question text. `item` is the item a `which:r` prompt chose (seeded), else undefined.
 *
 * @see BUILD_PLAN §5.1 (prompts)
 */
export function promptFor(
	note: AnswerNote,
	variant: string,
	rng: Rng
): { text: string; item?: number } {
	void note;
	void variant;
	void rng;
	throw new Error('not implemented');
}

/**
 * Builds what to show for the card: shuffled with the seeded RNG, falling back to another kind
 * when this one can't be built for the card.
 *
 * @see BUILD_PLAN §5.1
 */
export function buildExercise(input: ExerciseInput): Traced<ExerciseSpec> {
	void input;
	throw new Error('not implemented');
}
