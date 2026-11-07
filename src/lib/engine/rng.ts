/**
 * Seeded randomness for the engine. The engine never calls `Math.random`.
 *
 * @see CLAUDE.md rule 2
 * @see BUILD_PLAN Decisions log (RNG)
 */

/** A seeded generator: each call returns the next number in [0, 1). */
export type Rng = () => number;

/**
 * FNV-1a (32-bit) over the parts, joined with a separator that can't appear in an ID.
 *
 * @see BUILD_PLAN Decisions log (RNG)
 */
export function hashSeed(..._parts: readonly (string | number)[]): number {
	throw new Error('not implemented');
}

/** mulberry32 seeded with a 32-bit integer. */
export function createRng(_seed: number): Rng {
	throw new Error('not implemented');
}

/** The generator for one showing of a card. @see CLAUDE.md rule 2 */
export function rngFor(_cardId: string, _sessionId: string, _attempt: number): Rng {
	throw new Error('not implemented');
}

/** A Fisher–Yates shuffled copy; the input is not changed. */
export function shuffle<T>(_items: readonly T[], _rng: Rng): T[] {
	throw new Error('not implemented');
}
