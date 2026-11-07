/**
 * Seeded randomness for the engine. The engine never calls `Math.random`.
 *
 * @see CLAUDE.md rule 2
 * @see BUILD_PLAN Decisions log (RNG)
 */

/** A seeded generator: each call returns the next number in [0, 1). */
export type Rng = () => number;

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
/** Joins seed parts; a UUID or number never contains it. */
const SEPARATOR = '\u0000';
const UINT32 = 0x1_0000_0000;
const MULBERRY_STEP = 0x6d2b79f5;

/**
 * FNV-1a (32-bit) over the parts, joined with a separator that can't appear in an ID.
 *
 * @see BUILD_PLAN Decisions log (RNG)
 */
export function hashSeed(...parts: readonly (string | number)[]): number {
	const text = parts.map(String).join(SEPARATOR);
	let hash = FNV_OFFSET;
	for (let i = 0; i < text.length; i += 1) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, FNV_PRIME);
	}
	return hash >>> 0;
}

/** mulberry32 seeded with a 32-bit integer. */
export function createRng(seed: number): Rng {
	let state = seed >>> 0;
	return () => {
		state = (state + MULBERRY_STEP) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / UINT32;
	};
}

/** The generator for one showing of a card. @see CLAUDE.md rule 2 */
export function rngFor(cardId: string, sessionId: string, attempt: number): Rng {
	return createRng(hashSeed(cardId, sessionId, attempt));
}

/** A Fisher–Yates shuffled copy; the input is not changed. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rng() * (i + 1));
		[copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
	}
	return copy;
}
