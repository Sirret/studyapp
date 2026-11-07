import type { CardId } from '#lib/db/schemas/common.ts';
import { assertNever } from '#lib/util/result.ts';
import type {
	ChooseManySpec,
	ChooseSpec,
	ExerciseSpec,
	OrderSpec,
	PairSpec,
	SortSpec,
	TypeSpec
} from './exercise-types.ts';
import { gradeTyped } from './grading.ts';
import { gradeSequence } from './grading-shapes.ts';
import type { Traced } from './trace.ts';

/** The student's response, matching the spec's `shape`. @see BUILD_PLAN §5.1 */
export type ExerciseResponse =
	| { shape: 'type'; typed: string }
	| { shape: 'choose'; index: number }
	| { shape: 'chooseMany'; indexes: number[] }
	| { shape: 'order'; order: number[] }
	| { shape: 'pair'; matches: number[] }
	| { shape: 'sort'; placed: number[] }
	| { shape: 'selfRate'; rating?: 'again' | 'hard' | 'good'; checked: number[] }
	| { shape: 'study' };

/** The verdict and what feedback shows. @see BUILD_PLAN §5.1 (feedback) and §6.4 */
export interface ExerciseVerdict {
	correct: boolean;
	/** The right answer as text; one line per part for shapes with several parts. */
	reveal: string[];
	/** The normalised typed text, or the chosen option text(s). */
	chosen?: string;
	/** Another card whose answer the student gave instead (confusion pair). */
	chosenFromCardId?: CardId;
	/** "You chose X — that's the answer to Y". */
	contrast?: { chosen: string; answers: string };
	/** The wrong parts: item, left or option indexes. */
	marks: number[];
}

type ResponseOf<S extends ExerciseSpec['shape']> = Extract<ExerciseResponse, { shape: S }>;

function checkTyped(spec: TypeSpec, { typed }: ResponseOf<'type'>): ExerciseVerdict {
	const { result } = gradeTyped({
		cardId: spec.cardId,
		typed,
		answer: spec.answer,
		accepted: spec.accepted,
		others: spec.others
	});
	const other = spec.others.find((entry) => entry.cardId === result.chosenFromCardId);
	const answers = result.chosenFromCardId && spec.otherPrompts?.[result.chosenFromCardId];
	return {
		correct: result.correct,
		reveal: [spec.answer],
		chosen: result.normalized,
		marks: [],
		...(result.chosenFromCardId ? { chosenFromCardId: result.chosenFromCardId } : {}),
		...(other && answers ? { contrast: { chosen: other.text, answers } } : {})
	};
}

function checkChoice(spec: ChooseSpec, { index }: ResponseOf<'choose'>): ExerciseVerdict {
	const correct = index === spec.correctIndex;
	const option = spec.options[index];
	const fromOther = !correct && option?.cardId !== undefined;
	return {
		correct,
		reveal: [spec.options[spec.correctIndex]?.text ?? ''],
		marks: correct ? [] : [index],
		...(option ? { chosen: option.text } : {}),
		...(fromOther ? { chosenFromCardId: option.cardId } : {}),
		...(fromOther && option.answers
			? { contrast: { chosen: option.text, answers: option.answers } }
			: {})
	};
}

function checkMany(spec: ChooseManySpec, { indexes }: ResponseOf<'chooseMany'>): ExerciseVerdict {
	const picked = new Set(indexes);
	const right = new Set(spec.correct);
	const marks = spec.options.map((_option, i) => i).filter((i) => picked.has(i) !== right.has(i));
	return {
		correct: marks.length === 0,
		reveal: spec.correct.map((i) => spec.options[i]?.text ?? ''),
		chosen: [...picked]
			.sort((a, b) => a - b)
			.map((i) => spec.options[i]?.text ?? '')
			.join(', '),
		marks
	};
}

function checkOrder(spec: OrderSpec, { order }: ResponseOf<'order'>): ExerciseVerdict {
	const extras = new Set(spec.extras);
	const placedExtras = order.filter((item) => extras.has(item));
	const ranks = order
		.filter((item) => !extras.has(item))
		.map((item) => spec.correctOrder.indexOf(item));
	const complete =
		ranks.length === spec.correctOrder.length &&
		new Set(ranks).size === ranks.length &&
		!ranks.includes(-1);
	const misplaced = complete
		? gradeSequence(ranks).result.misplaced.map((rank) => spec.correctOrder[rank] as number)
		: [];
	const marks = [...misplaced, ...placedExtras].sort((a, b) => a - b);
	return {
		correct: complete && marks.length === 0,
		reveal: spec.correctOrder.map((item) => spec.items[item] ?? ''),
		chosen: order.map((item) => spec.items[item] ?? '').join(' → '),
		marks
	};
}

function checkPairs(spec: PairSpec, { matches }: ResponseOf<'pair'>): ExerciseVerdict {
	const marks = spec.pairs.map((_right, i) => i).filter((i) => matches[i] !== spec.pairs[i]);
	return {
		correct: marks.length === 0,
		reveal: spec.left.map((left, i) => `${left} — ${spec.right[spec.pairs[i] ?? -1] ?? ''}`),
		marks
	};
}

function checkSort(spec: SortSpec, { placed }: ResponseOf<'sort'>): ExerciseVerdict {
	const marks = spec.bucketOf.map((_bucket, i) => i).filter((i) => placed[i] !== spec.bucketOf[i]);
	return {
		correct: marks.length === 0,
		reveal: spec.items.map((item, i) => `${item} — ${spec.buckets[spec.bucketOf[i] ?? -1] ?? ''}`),
		marks
	};
}

function mismatch(spec: ExerciseSpec, response: ExerciseResponse): never {
	throw new Error(`A ${response.shape} response can't answer a ${spec.shape} exercise`);
}

function verdictOf(spec: ExerciseSpec, response: ExerciseResponse): ExerciseVerdict {
	if (spec.shape !== response.shape) mismatch(spec, response);
	switch (spec.shape) {
		case 'type':
			return checkTyped(spec, response as ResponseOf<'type'>);
		case 'choose':
			return checkChoice(spec, response as ResponseOf<'choose'>);
		case 'chooseMany':
			return checkMany(spec, response as ResponseOf<'chooseMany'>);
		case 'order':
			return checkOrder(spec, response as ResponseOf<'order'>);
		case 'pair':
			return checkPairs(spec, response as ResponseOf<'pair'>);
		case 'sort':
			return checkSort(spec, response as ResponseOf<'sort'>);
		case 'selfRate':
			return { correct: true, reveal: spec.answer.split('\n'), marks: [] };
		case 'study':
			return { correct: true, reveal: spec.steps.map((s) => `${s.subgoal}: ${s.step}`), marks: [] };
		default:
			return assertNever(spec);
	}
}

/**
 * Grades a response against its spec. Self-rated and study shapes are never graded and return
 * `correct: true`. Throws if the response's shape doesn't match the spec's (a caller bug).
 *
 * @see BUILD_PLAN §5.1 and §6.10
 */
export function checkResponse(
	spec: ExerciseSpec,
	response: ExerciseResponse
): Traced<ExerciseVerdict> {
	const result = verdictOf(spec, response);
	return {
		result,
		trace: [
			{ rule: 'exercise.check', shape: spec.shape, correct: result.correct, marks: result.marks }
		]
	};
}
