import { afterEach, describe, expect, it, vi } from 'vitest';
import { HAPTIC_TICK_MS } from '#lib/config/defaults.ts';
import { effectOn, hapticTick, type DelightEffect } from '#lib/ui/delight/delight.ts';

const ALL: DelightEffect[] = [
	'pawPress',
	'checkDraw',
	'haptic',
	'pawControls',
	'snowBurst',
	'snowFlurry',
	'pawStamp',
	'countUp',
	'pawWalk',
	'pawLoader'
];

describe('effectOn (DESIGN §11.2 settings mapping)', () => {
	it('full runs every effect', () => {
		expect(ALL.every((effect) => effectOn(effect, 'full'))).toBe(true);
	});

	it('quiet runs only paw press, check draw, haptic tick and paw controls', () => {
		expect(ALL.filter((effect) => effectOn(effect, 'quiet'))).toStrictEqual([
			'pawPress',
			'checkDraw',
			'haptic',
			'pawControls'
		]);
	});

	it('off runs none', () => {
		expect(ALL.some((effect) => effectOn(effect, 'off'))).toBe(false);
	});
});

describe('hapticTick', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('vibrates briefly when enabled and supported, never otherwise', () => {
		const vibrate = vi.fn();
		vi.stubGlobal('navigator', { vibrate });
		hapticTick(false);
		expect(vibrate).not.toHaveBeenCalled();
		hapticTick(true);
		expect(vibrate).toHaveBeenCalledWith(HAPTIC_TICK_MS);
	});

	it('does nothing where vibration is unsupported', () => {
		vi.stubGlobal('navigator', {});
		expect(() => hapticTick(true)).not.toThrow();
	});
});
