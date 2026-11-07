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
	const state = $derived(phase === 'new' ? 'read' : 'think');

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
		border: var(--hairline) solid var(--card-edge);
		border-radius: var(--r-xl);
		background: var(--surface);
		box-shadow: var(--shadow-1);
		color: var(--text);
		cursor: pointer;
		animation: fade var(--dur-base) var(--ease-out);
	}

	.line {
		font-size: var(--type-heading-size);
		font-weight: var(--type-heading-weight);
	}

	.skip {
		color: var(--text-muted);
		font-size: var(--type-small-size);
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
	}
</style>
