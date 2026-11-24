import {
	DEV_SEED_ANSWERS_PER_DAY,
	DEV_SEED_CORRECT_RATE,
	DEV_SEED_HISTORY_DAYS,
	DEV_SEED_SHELF_COURSES
} from '#lib/config/defaults.ts';
import type { CardId, ExamFormat, ExerciseKind } from '#lib/db/schemas/common.ts';
import { createRng, hashSeed } from '#lib/engine/rng.ts';

/**
 * What `/dev/seed` creates, as plain data: pure and deterministic, so it is unit tested and every
 * seeded run is the same. The writing (images, imports, events) is `dev-seed.ts`.
 *
 * @see Decisions log "Pre-review step: /dev/seed"
 */

/** One course to create: its import text, the pictures it names, and its exam. */
export interface SeedCourse {
	name: string;
	text: string;
	/** File names the text names (`@occlusion x.png`, `source: x.png`), generated as pictures. */
	images: string[];
	/** Days from today to the exam; `null` = no exam date (long-term). */
	examInDays: number | null;
	examFormat: ExamFormat;
	/** Gets synthetic study history (the Rich seed only). */
	history: boolean;
}

/** The golden import texts (`tests/golden/import/`) and the dev sample course. */
export interface SeedTexts {
	figures: string;
	full: string;
	malformed: string;
	sample: string;
}

/** The pictures an import text names, in order, each once. */
export function imageNames(text: string): string[] {
	const names = [...text.matchAll(/^(?:@occlusion|source:)\s+(\S+\.(?:png|jpe?g|webp))\s*$/gim)];
	return [...new Set(names.map((match) => match[1] ?? ''))].filter((name) => name !== '');
}

function course(
	name: string,
	text: string,
	examInDays: number | null,
	examFormat: ExamFormat
): SeedCourse {
	return { name, text, images: imageNames(text), examInDays, examFormat, history: true };
}

/**
 * The "Rich" seed: six courses from the golden texts, with every figure kind (occlusion with
 * `box:` lines, a stack and a flow diagram), staggered exams (tomorrow to three weeks, one
 * long-term) and synthetic history.
 */
export function richSeedPlan(texts: SeedTexts): SeedCourse[] {
	return [
		course('Database storage', texts.figures, 3, 'recall'),
		course('Networking basics', texts.sample, 1, 'mixed'),
		course('Networks and databases', texts.full, 6, 'mixed'),
		course('Systems analysis', texts.sample, null, 'mixed'),
		course('Database storage II (final)', texts.figures, 14, 'recognition'),
		course('Imported with errors', texts.malformed, 21, 'recall')
	];
}

const SUBJECTS = [
	'Intro to Programming',
	'Data Structures',
	'Operating Systems',
	'Computer Networks',
	'Database Systems',
	'Software Engineering',
	'Discrete Mathematics',
	'Information Systems',
	'Web Development',
	'Computer Architecture'
];

/** Titles at the edges: very long (near the 120-character limit), very short, accents, symbols. */
const ODD_TITLES = [
	'Advanced Topics in Distributed Systems, Cloud Infrastructure and Fault-Tolerant Computing (Section B, evening cohort)',
	'OS',
	'Économie numérique & systèmes d’information — Ürün Yönetimi',
	'Statistics for Information Systems: Probability, Inference, Regression and an Introduction to Data Mining',
	'C++ / Java: OOP (2nd try!)',
	'Human–Computer Interaction and User Experience Research Methods for Mobile-First Applications in Low-Bandwidth Regions'
];

/** Exam offsets the shelf cycles through: soon, far, none, and one already past. */
const SHELF_EXAMS: readonly (number | null)[] = [2, 5, null, 9, 14, null, 30, 1, 60, null, -2, 0];

function shelfTitle(index: number): string {
	const odd = ODD_TITLES[index / 8];
	if (index % 8 === 0 && odd) return odd;
	return `${SUBJECTS[index % SUBJECTS.length]} ${101 + index}`;
}

function shelfText(index: number): string {
	return `@deck Week ${(index % 12) + 1}\n@fact\nTerm ${index}a :: first definition of course ${index}\nTerm ${index}b :: second definition of course ${index}\n@end`;
}

/** The "Shelf stress" seed: many small courses with varied titles and exam dates. */
export function shelfSeedPlan(count = DEV_SEED_SHELF_COURSES): SeedCourse[] {
	return Array.from({ length: count }, (_, index) => ({
		name: shelfTitle(index),
		text: shelfText(index),
		images: [],
		examInDays: SHELF_EXAMS[index % SHELF_EXAMS.length] ?? null,
		examFormat: 'mixed',
		history: false
	}));
}

/** A card as the history generator needs it: its ID and the first kind of its path. */
export interface SeedCard {
	id: CardId;
	kind: ExerciseKind;
}

/** One synthetic answer: `daysAgo` ≥ 1 and its place in that day's session. */
export interface SeedAnswer {
	cardId: CardId;
	kind: ExerciseKind;
	correct: boolean;
	daysAgo: number;
	/** 0-based position in that day's session (the writer spaces answers by a fixed gap). */
	index: number;
}

/**
 * A few days of answers for one course, oldest first, from a fixed seed and the course key.
 * Cards are taken in turn from a seeded start, so most cards get seen and some twice.
 */
export function syntheticAnswers(
	cards: readonly SeedCard[],
	key: string,
	seed: number,
	days = DEV_SEED_HISTORY_DAYS
): SeedAnswer[] {
	if (cards.length === 0) return [];
	const rng = createRng(hashSeed(seed, key));
	const answers: SeedAnswer[] = [];
	let next = Math.floor(rng() * cards.length);
	for (let daysAgo = days; daysAgo >= 1; daysAgo -= 1) {
		for (let index = 0; index < DEV_SEED_ANSWERS_PER_DAY; index += 1) {
			const card = cards[next % cards.length] as SeedCard;
			next += 1;
			const correct = rng() < DEV_SEED_CORRECT_RATE;
			answers.push({ cardId: card.id, kind: card.kind, correct, daysAgo, index });
		}
	}
	return answers;
}
