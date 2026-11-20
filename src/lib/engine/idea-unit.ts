import type { Weight } from '#lib/db/schemas/common.ts';
import { allowedEdits, normalizeAnswer, osaDistance, textLength } from './grading.ts';
import type { Traced } from './trace.ts';

/** An idea-unit grade. @see Decisions log "Phase 8.6 Q1" */
export interface IdeaUnitGrade {
	/** Every key word is ticked. */
	correct: boolean;
	/** `full` when every tick was a pre-tick; `recognition` when the student ticked one themselves. */
	weight: Weight;
	/** Key word indexes the typed text matches (what the app pre-ticked). */
	preTicked: number[];
	/** Key word indexes left unticked, ascending. */
	missing: number[];
}

/** True when some run of `key`'s word count in `words` equals it, or is within its tolerance. */
function holds(words: readonly string[], key: string): boolean {
	const size = key.split(' ').length;
	const tolerance = allowedEdits(textLength(key));
	for (let start = 0; start + size <= words.length; start += 1) {
		const window = words.slice(start, start + size).join(' ');
		if (window === key || osaDistance(window, key) <= tolerance) return true;
	}
	return false;
}

/**
 * The key words the typed text holds, as ascending indexes: a key word matches when its
 * normalised form (`normalizeAnswer`) appears in the normalised typed text as whole words, or a
 * fuzzy match within `allowedEdits` of the key word's length. These are pre-ticked for the student.
 *
 * @see SESSION_NOTES D3 ("the app pre-ticks keyword matches") and BUILD_PLAN §5.1 row ideaUnit
 */
export function matchKeyWords(typed: string, keyWords: readonly string[]): Traced<number[]> {
	const text = normalizeAnswer(typed);
	const words = text === '' ? [] : text.split(' ');
	const result: number[] = [];
	keyWords.forEach((keyWord, index) => {
		const key = normalizeAnswer(keyWord);
		if (key !== '' && holds(words, key)) result.push(index);
	});
	return {
		result,
		trace: [{ rule: 'ideaUnit.match', keyWords: keyWords.length, matched: result }]
	};
}

/**
 * Grades an idea-unit answer: correct when every key word index is in `ticked`; weight `full` when
 * every ticked index is also pre-ticked (`matchKeyWords(typed, keyWords)`), else `recognition`.
 * Out-of-range or repeated ticks are ignored. A note with no key words can't be graded this way
 * (throws; the builder falls back to `cloze`).
 *
 * @see BUILD_PLAN §5.1 row ideaUnit and Decisions log "Phase 8.6 Q1"
 */
export function gradeIdeaUnit(input: {
	typed: string;
	keyWords: readonly string[];
	ticked: readonly number[];
}): Traced<IdeaUnitGrade> {
	const { keyWords } = input;
	if (keyWords.length === 0) throw new Error('An idea-unit answer needs key words');
	const { result: preTicked, trace } = matchKeyWords(input.typed, keyWords);
	const ticked = new Set(
		input.ticked.filter((i) => Number.isInteger(i) && i >= 0 && i < keyWords.length)
	);
	const missing = keyWords.map((_word, i) => i).filter((i) => !ticked.has(i));
	const pre = new Set(preTicked);
	const selfTicked = [...ticked].some((i) => !pre.has(i));
	const result: IdeaUnitGrade = {
		correct: missing.length === 0,
		weight: selfTicked ? 'recognition' : 'full',
		preTicked,
		missing
	};
	trace.push({ rule: 'ideaUnit.grade', correct: result.correct, weight: result.weight, missing });
	return { result, trace };
}
