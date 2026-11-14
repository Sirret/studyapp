import type { CardId, CardStatus, MediaId, NoteId } from '#lib/db/schemas/common.ts';
import type { CardListRow } from '#lib/services/card-list-types.ts';
import type { CourseMap } from '#lib/db/schemas/course.ts';
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
	plan: { topics: [], coverage: ['Transport', 'Indexing'], map: null, status: 'complete' as const },
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
	ended: false,
	status: 'cut',
	warnings: [],
	checklist: [],
	missing: [],
	resumePrompt: null,
	starredGaps: [],
	duplicates: []
} satisfies ImportPreview;

/** The resume state: a reply that stopped at a topic break, with a checklist, a missing part and a warning. */
export const SAMPLE_IMPORT_RESUME = {
	...SAMPLE_IMPORT_PREVIEW,
	status: 'stopped',
	ended: true,
	warnings: [{ line: 4, message: 'Unknown directive "@exam". The line is skipped.' }],
	checklist: [
		{ key: 'lecture-1', title: 'Lecture 1: Introduction', imported: true, partial: false },
		{ key: 'lecture-2', title: 'Lecture 2: Relational Algebra', imported: true, partial: true },
		{ key: 'lecture-3', title: 'Lecture 3: Joins', imported: false, partial: false }
	],
	missing: ['Slides 14 to 16 (too blurry to read)'],
	resumePrompt: 'Continue my study pack for this course from "Lecture 3: Joins".'
} satisfies ImportPreview;

/** A course map for the style guide: big picture, habit questions and a small cheat table. */
export const SAMPLE_COURSE_MAP: CourseMap = {
	bigpicture: ['Routing gets packets between networks; transport gets them between programs.'],
	habit: ['Why does DNS use UDP but a file transfer use TCP?'],
	topics: [],
	links: [],
	cheat: {
		name: 'Cheat table: transport protocols',
		items: ['TCP', 'UDP'],
		rows: [
			{ attribute: 'Connection', values: ['Yes', 'No'] },
			{ attribute: 'Delivery', values: ['Guaranteed', 'Best effort'] }
		]
	},
	missing: []
};

/** A few lines of import text, for the paste-area sample. */
export const SAMPLE_IMPORT_TEXT = [
	'@deck Lecture 1',
	'@fact',
	'TCP :: reliable byte stream',
	'@end'
].join('\n');

const sampleCard = (status: CardStatus, suspended = false) => ({
	id: crypto.randomUUID() as CardId,
	variant: 'forward',
	status,
	suspended
});

/** Card-list rows for the style guide: plain, flagged by the import, paused, and an image card. */
export const SAMPLE_CARD_ROWS: CardListRow[] = [
	{
		noteId: crypto.randomUUID() as NoteId,
		type: 'keyterm',
		content: {
			type: 'keyterm',
			payload: { term: 'TCP', meaning: 'Transmission Control Protocol' }
		},
		prompt: 'TCP',
		answer: 'Transmission Control Protocol',
		flagged: false,
		generated: false,
		tags: [],
		cards: [sampleCard('exam-ready'), sampleCard('learning')]
	},
	{
		noteId: crypto.randomUUID() as NoteId,
		type: 'sequence',
		content: { type: 'sequence', payload: { name: 'Handshake', steps: ['SYN', 'SYN-ACK', 'ACK'] } },
		prompt: 'Handshake',
		answer: 'SYN → SYN-ACK → ACK',
		flagged: true,
		generated: true,
		tags: [],
		cards: [sampleCard('unseen')]
	},
	{
		noteId: crypto.randomUUID() as NoteId,
		type: 'fact',
		content: { type: 'fact', payload: { term: 'UDP', definition: 'reliable delivery' } },
		prompt: 'UDP',
		answer: 'reliable delivery',
		flagged: true,
		generated: false,
		tags: [],
		cards: [sampleCard('needs-work', true)]
	},
	{
		noteId: crypto.randomUUID() as NoteId,
		type: 'occlusion',
		content: { type: 'occlusion', payload: { mediaId: crypto.randomUUID() as MediaId, boxes: [] } },
		prompt: 'Label the image',
		answer: 'Router, Switch',
		flagged: false,
		generated: false,
		tags: [],
		cards: [sampleCard('provisional')]
	}
];
