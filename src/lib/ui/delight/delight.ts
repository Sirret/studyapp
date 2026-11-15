import { HAPTIC_TICK_MS } from '#lib/config/defaults.ts';

/** The companion setting, which also chooses the delight effects (DESIGN §8, §9 settings). */
export type CompanionLevel = 'full' | 'quiet' | 'off';

/** Effects that run on `quiet`; `full` runs everything, `off` nothing. */
const QUIET_EFFECTS = new Set(['pawPress', 'checkDraw', 'haptic', 'pawControls']);

export type DelightEffect =
	| 'pawPress'
	| 'checkDraw'
	| 'haptic'
	| 'pawControls'
	| 'snowBurst'
	| 'snowFlurry'
	| 'pawStamp'
	| 'countUp'
	| 'pawWalk'
	| 'pawLoader'
	| 'snowFall';

/** Whether an effect runs at this companion level. @see DESIGN §9 (settings: quiet = small and static) */
export function effectOn(effect: DelightEffect, level: CompanionLevel): boolean {
	if (level === 'off') return false;
	return level === 'full' || QUIET_EFFECTS.has(effect);
}

/**
 * A short vibration on a first-attempt correct, where the device supports it. Never blocks.
 * @see DESIGN §8
 */
export function hapticTick(enabled: boolean): void {
	if (enabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
		navigator.vibrate(HAPTIC_TICK_MS);
	}
}
