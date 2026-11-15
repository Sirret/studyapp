<!--
	Phase interstitial (DESIGN §7.3): a short card between session phases — Yuki in the matching
	state and one line. Tap anywhere to skip; it also leaves by itself after
	`PHASE_INTERSTITIAL_MS`. Shown only when Yuki is on full.
-->
<script lang="ts">
	import { PHASE_INTERSTITIAL_MS } from '#lib/config/defaults.ts';
	import type { SessionPhase } from '#lib/db/schemas/session.ts';
	import Yuki from './yuki/Yuki.svelte';

	let { phase, ondone }: { phase: SessionPhase; ondone: () => void } = $props();

	const LINES: Record<SessionPhase, string> = {
		warmup: 'Warm-up first, no pressure',
		new: 'New material next',
		recall: 'Recall time: pull it from memory',
		discrimination: 'Now compare the look-alikes',
		cleanup: 'Last pass over the tricky ones'
	};
	const state = $derived(phase === 'new' ? 'idle' : 'thinking');

	$effect(() => {
		const timer = setTimeout(ondone, PHASE_INTERSTITIAL_MS);
		return () => clearTimeout(timer);
	});
</script>

<button type="button" class="interstitial" onclick={ondone} data-interstitial={phase}>
	<Yuki {state} size={120} />
	<span class="line">{LINES[phase]}</span>
	<span class="skip">Tap to continue</span>
</button>

<style>
	.interstitial {
		display: grid;
		justify-items: center;
		gap: var(--gap-md);
		width: 100%;
		padding: var(--gap-2xl) var(--gap-lg);
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-md);
		background: var(--surface);
		box-shadow: var(--shadow-raised);
		color: var(--text);
		font-family: var(--font-body);
		cursor: pointer;
		animation: fade var(--dur-base) var(--ease-out);
	}

	.line {
		color: var(--text-strong);
		font-family: var(--font-display);
		font-size: var(--type-title-size);
		line-height: var(--type-title-leading);
		font-style: italic;
		font-weight: var(--type-title-weight);
	}

	.skip {
		color: var(--text-soft);
		font-size: var(--type-small-size);
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
	}
</style>
