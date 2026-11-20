/**
 * Pure exercise rules the UI needs while the student answers, before anything is submitted. The
 * UI may not import the engine (BUILD_PLAN §15.1), so they are passed through here.
 *
 * @see BUILD_PLAN §5.1 row ideaUnit; SESSION_NOTES D3
 */
import { matchKeyWords } from '#lib/engine/idea-unit.ts';

/**
 * The key word indexes the typed definition already holds, ascending: the idea-unit exercise
 * pre-ticks these once the student has typed (`matchKeyWords`).
 *
 * @see Decisions log "Phase 8.6 Q1"
 */
export function preTickedKeyWords(typed: string, keyWords: readonly string[]): number[] {
	return matchKeyWords(typed, keyWords).result;
}
