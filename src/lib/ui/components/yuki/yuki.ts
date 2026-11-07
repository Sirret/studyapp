/** Yuki's states (DESIGN §7.3). */
export const YUKI_STATES = [
	'idle',
	'trot',
	'hop',
	'sparkle',
	'oops',
	'think',
	'read',
	'celebrate',
	'sleepy',
	'worried-kind',
	'sniff'
] as const;

export type YukiState = (typeof YUKI_STATES)[number];
