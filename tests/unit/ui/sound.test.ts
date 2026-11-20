import { describe, expect, it, vi } from 'vitest';
import { SOUND_EFFECTS } from '#lib/config/defaults.ts';
import {
	answerSound,
	createSoundPlayer,
	soundAllowed,
	type SoundContext,
	type SoundEffect
} from '#lib/ui/delight/sound.ts';

function param() {
	return {
		setValueAtTime: vi.fn(),
		linearRampToValueAtTime: vi.fn(),
		exponentialRampToValueAtTime: vi.fn()
	};
}

function node() {
	return { connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
}

/** A fake Web Audio context that counts what each sound builds. */
function fakeContext(state: AudioContextState = 'running') {
	const made = { oscillators: 0, sources: 0, filters: 0, gains: 0 };
	const ctx = {
		currentTime: 1,
		destination: {},
		sampleRate: 8000,
		state,
		resume: vi.fn(async () => undefined),
		createGain: () => {
			made.gains += 1;
			return { ...node(), gain: param() };
		},
		createOscillator: () => {
			made.oscillators += 1;
			return { ...node(), type: 'sine', frequency: param() };
		},
		createBuffer: (_channels: number, length: number) => {
			const data = new Float32Array(length);
			return { getChannelData: () => data };
		},
		createBufferSource: () => {
			made.sources += 1;
			return { ...node(), buffer: null };
		},
		createBiquadFilter: () => {
			made.filters += 1;
			return { ...node(), type: 'lowpass', frequency: param() };
		}
	};
	return { ctx: ctx as unknown as SoundContext, made };
}

/** @see SESSION_NOTES §D7; Decisions log "Phase 8.6 Q11" */
describe('sound effects', () => {
	it('play only on answering screens and only with sounds on', () => {
		expect(soundAllowed('session', true)).toBe(true);
		expect(soundAllowed('practice', true)).toBe(true);
		expect(soundAllowed('reader', true)).toBe(false);
		expect(soundAllowed('other', true)).toBe(false);
		expect(soundAllowed('session', false)).toBe(false);
	});

	it('picks stamp for a card that just became exam-ready, else crunch or low note', () => {
		expect(answerSound(true, true)).toBe('stamp');
		expect(answerSound(true, false)).toBe('crunch');
		expect(answerSound(false, false)).toBe('lowNote');
	});

	it.each(Object.keys(SOUND_EFFECTS) as SoundEffect[])('%s builds one node per tone', (effect) => {
		const { ctx, made } = fakeContext();
		createSoundPlayer(() => ctx).play(effect);
		const tones = SOUND_EFFECTS[effect];
		const noise = tones.filter((tone) => tone.wave === 'noise').length;
		expect(made.gains).toBe(tones.length);
		expect(made.sources).toBe(noise);
		expect(made.filters).toBe(noise);
		expect(made.oscillators).toBe(tones.length - noise);
	});

	it('makes the audio context once, on the first sound, and resumes a suspended one', () => {
		const { ctx } = fakeContext('suspended');
		const make = vi.fn(() => ctx);
		const player = createSoundPlayer(make);
		expect(make).not.toHaveBeenCalled();
		player.play('pawTap');
		player.play('crunch');
		expect(make).toHaveBeenCalledTimes(1);
		expect(ctx.resume).toHaveBeenCalled();
	});

	it('does nothing without Web Audio and never throws when a sound fails', () => {
		expect(() => createSoundPlayer(() => null).play('stamp')).not.toThrow();
		const broken = {
			...fakeContext().ctx,
			createGain: () => {
				throw new Error('no audio');
			}
		} as SoundContext;
		expect(() => createSoundPlayer(() => broken).play('stamp')).not.toThrow();
	});
});
