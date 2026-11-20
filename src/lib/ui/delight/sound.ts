import {
	SOUND_ATTACK_S,
	SOUND_EFFECTS,
	SOUND_VOLUME,
	type SoundTone
} from '#lib/config/defaults.ts';

/** The four sound effects (SESSION_NOTES §D7). */
export type SoundEffect = keyof typeof SOUND_EFFECTS;

/**
 * Where a sound would play. Only answering screens make sounds; reading never does (§D7: "never
 * during reading").
 */
export type SoundScreen = 'session' | 'practice' | 'reader' | 'other';

const SOUNDING: ReadonlySet<SoundScreen> = new Set(['session', 'practice']);

/**
 * Whether sound effects may play on this screen with the student's `Settings.sounds`.
 *
 * @see SESSION_NOTES §D7 and Decisions log "Phase 8.6 Q11"
 */
export function soundAllowed(screen: SoundScreen, sounds: boolean): boolean {
	return sounds && SOUNDING.has(screen);
}

/** The parts of Web Audio the synth uses (the real `AudioContext` fits; tests pass a fake). */
export type SoundContext = Pick<
	AudioContext,
	| 'currentTime'
	| 'destination'
	| 'sampleRate'
	| 'state'
	| 'resume'
	| 'createGain'
	| 'createOscillator'
	| 'createBuffer'
	| 'createBufferSource'
	| 'createBiquadFilter'
>;

/** Shapes a tone: a short fade in, then an exponential fall to near silence. */
function envelope(ctx: SoundContext, start: number, tone: SoundTone): GainNode {
	const gain = ctx.createGain();
	const peak = tone.gain * SOUND_VOLUME;
	const floor = peak / 1000;
	gain.gain.setValueAtTime(floor, start);
	gain.gain.linearRampToValueAtTime(peak, start + SOUND_ATTACK_S);
	gain.gain.exponentialRampToValueAtTime(floor, start + tone.duration);
	gain.connect(ctx.destination);
	return gain;
}

function playOscillator(ctx: SoundContext, start: number, tone: SoundTone, out: GainNode): void {
	const osc = ctx.createOscillator();
	osc.type = tone.wave === 'triangle' ? 'triangle' : 'sine';
	osc.frequency.setValueAtTime(tone.freq, start);
	if (tone.endFreq !== undefined) {
		osc.frequency.exponentialRampToValueAtTime(tone.endFreq, start + tone.duration);
	}
	osc.connect(out);
	osc.start(start);
	osc.stop(start + tone.duration);
}

function playNoise(ctx: SoundContext, start: number, tone: SoundTone, out: GainNode): void {
	const length = Math.max(1, Math.ceil(ctx.sampleRate * tone.duration));
	const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	// Noise for a sound effect; the engine's seeded rng is for study decisions, not audio.
	for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
	const source = ctx.createBufferSource();
	source.buffer = buffer;
	const band = ctx.createBiquadFilter();
	band.type = 'bandpass';
	band.frequency.setValueAtTime(tone.freq, start);
	source.connect(band);
	band.connect(out);
	source.start(start);
	source.stop(start + tone.duration);
}

/** A sound player; the audio context is made on the first sound, after a user gesture. */
export interface SoundPlayer {
	play(effect: SoundEffect): void;
}

/**
 * Makes a player that synthesizes the effects with Web Audio: no audio files, works offline.
 * `makeContext` returns `null` where Web Audio is missing; then nothing plays. Playing never
 * throws: a failed sound is skipped.
 *
 * @see Decisions log "Phase 8.6 Q11"
 */
export function createSoundPlayer(makeContext: () => SoundContext | null): SoundPlayer {
	let ctx: SoundContext | null | undefined;
	return {
		play(effect) {
			try {
				ctx ??= makeContext();
				if (!ctx) return;
				if (ctx.state === 'suspended') void ctx.resume();
				const start = ctx.currentTime;
				for (const tone of SOUND_EFFECTS[effect]) {
					const at = start + tone.at;
					const out = envelope(ctx, at, tone);
					if (tone.wave === 'noise') playNoise(ctx, at, tone, out);
					else playOscillator(ctx, at, tone, out);
				}
			} catch {
				// A sound is a nicety: never break the screen over it.
			}
		}
	};
}

function browserContext(): SoundContext | null {
	return typeof AudioContext === 'undefined' ? null : new AudioContext();
}

const player = createSoundPlayer(browserContext);

/**
 * Plays `effect` when `soundAllowed(screen, sounds)`.
 *
 * @see SESSION_NOTES §D7
 */
export function playSound(effect: SoundEffect, screen: SoundScreen, sounds: boolean): void {
	if (soundAllowed(screen, sounds)) player.play(effect);
}

/** The sound for a first-attempt answer: stamp when the card just became exam-ready, else crunch or low note. */
export function answerSound(correct: boolean, becameReady: boolean): SoundEffect {
	if (becameReady) return 'stamp';
	return correct ? 'crunch' : 'lowNote';
}
