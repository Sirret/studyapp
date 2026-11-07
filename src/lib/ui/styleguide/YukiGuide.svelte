<!-- Yuki in the style guide: every state side by side, plus an interstitial. Dev builds only. -->
<script lang="ts">
	import PhaseInterstitial from '../components/PhaseInterstitial.svelte';
	import Yuki from '../components/yuki/Yuki.svelte';
	import { YUKI_STATES } from '../components/yuki/yuki.ts';
	import GuideRow from './GuideRow.svelte';
	import GuideSection from './GuideSection.svelte';

	let showInterstitial = $state(true);
</script>

<GuideSection id="yuki" title="Yuki" layer="Layer 6 — companion">
	<GuideRow label="States (DESIGN §7.3)">
		{#each YUKI_STATES as state (state)}
			<figure class="state" data-guide-yuki={state}>
				<Yuki {state} size={96} />
				<figcaption>{state}</figcaption>
			</figure>
		{/each}
	</GuideRow>
	<GuideRow label="Sizes: progress 28, header 32, empty 96, interstitial 120, summary 140">
		{#each [28, 32, 96, 120, 140] as size (size)}<Yuki state="idle" {size} still />{/each}
	</GuideRow>
	<GuideRow label="Phase interstitial (tap to dismiss; returns on reload)">
		{#if showInterstitial}
			<PhaseInterstitial phase="discrimination" ondone={() => (showInterstitial = false)} />
		{/if}
	</GuideRow>
</GuideSection>

<style>
	.state {
		display: grid;
		justify-items: center;
		gap: var(--gap-xs);
		margin: 0;
	}

	figcaption {
		color: var(--text-muted);
		font-size: var(--type-caption-size);
	}
</style>
