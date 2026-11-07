import { HAPTIC_TICK_MS } from '#lib/config/defaults.ts';

/** The companion setting, which also chooses the delight effects (DESIGN §11.2). */
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
	| 'pawLoader';

/** Whether an effect runs at this companion level. @see DESIGN §11.2 (settings mapping) */
export function effectOn(effect: DelightEffect, level: CompanionLevel): boolean {
	if (level === 'off') return false;
	return level === 'full' || QUIET_EFFECTS.has(effect);
}

/**
 * A short vibration on a first-attempt correct, where the device supports it. Never blocks.
 * @see DESIGN §11.2 (haptic tick)
 */
export function hapticTick(enabled: boolean): void {
	if (enabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
		navigator.vibrate(HAPTIC_TICK_MS);
	}
}
