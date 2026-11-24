import type { CardId, ExerciseKind, MediaId, NoteId } from '#lib/db/schemas/common.ts';
import type { Note } from '#lib/db/schemas/note.ts';
import type { AnswerNote } from './answers.ts';
import type { DiagramLayout } from './diagram-layout.ts';
import type { OtherAnswer } from './grading.ts';
import type { Rng } from './rng.ts';

/** What every exercise spec carries. @see BUILD_PLAN §5.1 */
export interface SpecBase {
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

/** A hide box of an image, as fractions of its width and height. The label is never sent. */
export interface FigureBox {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

/**
 * An image with hide boxes. `covered` lists the boxes drawn covered: only the target in hide-one
 * mode, every box in hide-all mode and for `occlusionDrag`. `target` is the box the question asks
 * about, drawn highlighted; null when the student must find it (`occlusionDrag`).
 *
 * @see BUILD_PLAN §7.1; Decisions log "Phase 6 Q3", "Phase 6 Q10–Q13"
 */
export interface OcclusionFigure {
	kind: 'occlusion';
	mediaId: MediaId;
	/** The image's name for screen readers. */
	title: string;
	boxes: FigureBox[];
	covered: string[];
	target: string | null;
}

/**
 * A drawn diagram. A node label that is `null` is hidden (the asked part); an arrow label is
 * `null` when hidden or when the arrow has none (`target` tells which is asked). `layout` is
 * null when the diagram is too big to draw (Decisions log "Phase 6 Q4"); the screen then shows
 * its text form. `sourceMediaId` is the original picture, for "Show original" after answering.
 *
 * @see BUILD_PLAN §7.2
 */
export interface DiagramFigure {
	kind: 'diagram';
	shape: 'stack' | 'flow';
	title: string;
	nodes: { id: string; label: string | null; role?: string }[];
	edges: { id: string; from: string; to: string; label: string | null }[];
	/** The node or arrow the question asks about, drawn highlighted; null for none. */
	target: string | null;
	layout: DiagramLayout | null;
	sourceMediaId?: MediaId;
}

/** What a figure-based exercise shows above or around its question. */
export type Figure = OcclusionFigure | DiagramFigure;

/** Typed recall. @see BUILD_PLAN §5.1 */
export interface TypeSpec extends SpecBase {
	shape: 'type';
	answer: string;
	accepted: string[];
	/** The course's other answers, for the collision guard. */
	others: OtherAnswer[];
	/** Each other card's prompt, for contrast on a typed collision. */
	otherPrompts?: Partial<Record<CardId, string>>;
	/** The first letter, shown as a hint (`firstLetterType`), else null. */
	letter: string | null;
	/** Lines shown above the prompt (the worked steps of a `fadeStep`), else empty. */
	context: string[];
	/** The image or diagram the question is about (`occlusionType`, `nodeCloze`, `edgeCloze`). */
	figure?: Figure;
}

/** Pick one option. */
export interface ChooseSpec extends SpecBase {
	shape: 'choose';
	options: SpecOption[];
	correctIndex: number;
	/** The first letter (`firstLetterBank`), else null. */
	letter: string | null;
	/** The image the question is about (`occlusionBank`). */
	figure?: Figure;
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
	/** The stack drawn with its layer labels hidden (`layerOrder`). */
	figure?: Figure;
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
	/** A Practice flashcard of a figure card shows its picture or diagram (`PracticeService.deck`). */
	figure?: Figure;
}

/** Study a worked example once; never graded. */
export interface StudySpec extends SpecBase {
	shape: 'study';
	steps: { subgoal: string; step: string }[];
}

/**
 * Type the definition, then tick the key words it holds (`ideaUnit`). The app pre-ticks the key
 * words the typed text matches (`matchKeyWords`).
 *
 * @see BUILD_PLAN §5.1 row ideaUnit and Decisions log "Phase 8.6 Q1"
 */
export interface IdeaUnitSpec extends SpecBase {
	shape: 'ideaUnit';
	/** The definition, shown once the student has typed. */
	answer: string;
	/** The note's key words (idea units), in note order. */
	keyWords: string[];
}

/**
 * A list card: type the items (`listAll`, `listN`) or tap them among other lists' items
 * (`listPick`). "Which is NOT in the list" (`listNot`) is a `choose` spec.
 *
 * @see BUILD_PLAN §5.1 row listN and Decisions log "Phase 8.6 Q9"
 */
export interface ListSpec extends SpecBase {
	shape: 'list';
	entry: 'type' | 'pick';
	/** Every item of the list (the note's key words), in note order. */
	items: string[];
	/** Valid items needed for a correct answer: N, or `items.length` for the whole list. */
	required: number;
	/** `pick` only: this list's items mixed with other lists' items, shuffled; empty for `type`. */
	options: SpecOption[];
	/** `pick` only: indexes of the options that are items of this list, ascending. */
	correct: number[];
}

/**
 * Drag a label onto its box, or tap the box (`occlusionDrag`): every box is covered and none is
 * highlighted. Graded by `hitTest` on the drop point, or by the tapped box's id.
 *
 * @see BUILD_PLAN §7.1, §6.10 (hit test); Decisions log "Phase 6 Q3"
 */
export interface PlaceSpec extends SpecBase {
	shape: 'place';
	figure: OcclusionFigure;
	/** The label to place. */
	label: string;
	/** The box it belongs on. */
	boxId: string;
}

/**
 * Reconnect a diagram's arrows (`structureRebuild`): the nodes are drawn without arrows; the
 * student adds arrows by tapping a source node, then a target node. Graded as a set on
 * from → to only; arrow labels are not asked (Decisions log "Phase 6 Q8").
 *
 * @see BUILD_PLAN §7.2, §6.10 (set comparison)
 */
export interface ConnectSpec extends SpecBase {
	shape: 'connect';
	/** The diagram with every arrow removed (`edges` empty). */
	figure: DiagramFigure;
	/** The reference arrows, from → to node ids. */
	edges: { from: string; to: string }[];
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
	| StudySpec
	| IdeaUnitSpec
	| ListSpec
	| PlaceSpec
	| ConnectSpec;

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
