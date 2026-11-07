import type { CardStatus } from '#lib/db/schemas/common.ts';

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
