<!-- Yuki in the style guide (DESIGN §9): every state side by side, sizes, and an interstitial. Dev builds only. -->
<script lang="ts">
	import PhaseInterstitial from '../components/PhaseInterstitial.svelte';
	import Yuki from '../components/yuki/Yuki.svelte';
	import { YUKI_STATES } from '../components/yuki/yuki.ts';
	import GuideRow from './GuideRow.svelte';
	import GuideSection from './GuideSection.svelte';

	let showInterstitial = $state(true);
</script>

<GuideSection id="yuki" title="Yuki" layer="Layer 6 — companion">
	<GuideRow label="States (DESIGN §9)">
		{#each YUKI_STATES as state (state)}
			<figure class="state" data-guide-yuki={state}>
				<Yuki {state} size={120} />
				<figcaption>{state}</figcaption>
			</figure>
		{/each}
	</GuideRow>
	<GuideRow label="Quiet (still): small and static">
		{#each YUKI_STATES as state (state)}<Yuki {state} size={48} still />{/each}
	</GuideRow>
	<GuideRow label="Sizes: small 32 / 48 / 64 (footer, sidebar, header); big 100 / 140 / 180">
		{#each [32, 48, 64, 100, 140, 180] as size (size)}<Yuki state="idle" {size} still />{/each}
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
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size);
		letter-spacing: var(--type-label-tracking);
		text-transform: uppercase;
	}
</style>
