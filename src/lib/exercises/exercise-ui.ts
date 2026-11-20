/**
 * Small display rules shared by the exercise components and the session screens: what the hint
 * link says for each exercise shape, and the meta on the Check button.
 *
 * @see SESSION_NOTES J (micro hint); Decisions log "Phase 8.6 Q10"; DESIGN §7 PawButton meta
 */
import { HINT_WORDS } from '#lib/config/defaults.ts';
import type { ExerciseResponse, ExerciseShape } from '#lib/services/study-types.ts';

/**
 * The hint link's label per shape, or null where the shape has no hint. Mirrors the engine's
 * `microHint` rules (typed and idea unit → letters or first words; list → first words of the
 * list; pick one → one wrong option removed; every other shape → none).
 */
const HINT_LABELS: { readonly [S in ExerciseShape]: string | null } = {
	type: 'Hint · first letters',
	ideaUnit: 'Hint · first letters',
	list: `Hint · first ${HINT_WORDS} words of the list`,
	choose: 'Hint · remove one wrong answer',
	chooseMany: null,
	order: null,
	pair: null,
	sort: null,
	selfRate: null,
	study: null,
	place: null,
	connect: null
};

/** The hint link's label for an exercise shape, or null when that shape offers no hint. */
export function hintLabel(shape: ExerciseShape): string | null {
	return HINT_LABELS[shape];
}

/** The Check button's meta for a response: "N picked" on a list card's tap-pick, else none. */
export function checkMeta(response: ExerciseResponse | null): string | undefined {
	if (response?.shape !== 'list' || response.picked.length === 0) return undefined;
	return `${response.picked.length} picked`;
}
