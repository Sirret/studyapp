/**
 * Yuki's states (DESIGN §9): idle (Home, reader footer), happy (correct streaks, summary),
 * thinking (waiting for an answer, loading), sleepy (nothing due, late night, one-night mode) and
 * celebrate (topic done: happy plus a paw stamp nearby).
 */
export const YUKI_STATES = ['idle', 'happy', 'thinking', 'sleepy', 'celebrate'] as const;

export type YukiState = (typeof YUKI_STATES)[number];
