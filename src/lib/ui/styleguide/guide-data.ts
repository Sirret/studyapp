import type { CardStatus } from '#lib/db/schemas/common.ts';
import type { ImportPreview } from '#lib/services/import-service.ts';

/** Every card status, for the style guide. @see DATA_MODEL §4.4 */
export const CARD_STATUSES: readonly CardStatus[] = [
	'unseen',
	'learning',
	'needs-work',
	'provisional',
	'exam-ready',
	'secure',
	'one-night'
];

/** A sample import preview for the style guide: one problem, one unsure card, two topics. */
export const SAMPLE_IMPORT_PREVIEW = {
	plan: { topics: [], coverage: ['Transport', 'Indexing'] },
	images: [],
	errors: [{ line: 12, message: 'Expected "A -> B" or "A -> B : label". This line is skipped.' }],
	topics: [
		{ name: 'Lecture 1: Introduction', chunks: 3, notes: 12, cards: 18 },
		{ name: 'Lecture 2: Relational Algebra', chunks: 4, notes: 15, cards: 24 }
	],
	noteCounts: { keyterm: 6, fact: 8, cloze: 9, compare: 2, scenario: 5 },
	cardCount: 42,
	chunkCount: 7,
	generatedChunkCount: 0,
	checked: [{ line: 30, text: 'Basic operations :: select, project, union' }],
	unusedImages: [],
	ended: false
} satisfies ImportPreview;

/** A few lines of import text, for the paste-area sample. */
export const SAMPLE_IMPORT_TEXT = [
	'@deck Lecture 1',
	'@fact',
	'TCP :: reliable byte stream',
	'@end'
].join('\n');
