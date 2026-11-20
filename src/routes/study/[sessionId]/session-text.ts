import type { Mode } from '#lib/db/schemas/common.ts';

/**
 * The session summary's "what next" line for a session's mode.
 *
 * @see DESIGN §7.3 (session summary)
 */
export function nextLineFor(mode: Mode | undefined): string {
	if (mode === 'acquisition') return "Tomorrow's retest is where it counts.";
	if (mode === 'onenight') return 'Sleep is part of the plan: the morning check is the real test.';
	return "Come back tomorrow for the retest — that's when it sticks.";
}
