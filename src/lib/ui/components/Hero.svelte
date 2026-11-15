<!--
	Hero greeting (DESIGN §5 display, §1 ornament budget): the IM Fell italic screen title plus a
	Literata subline, for Home, Welcome and summaries only. `snow` lays the §8 SnowFall behind it
	(callers pass `effectOn('snowFall', level)`; it is off under reduced motion by itself).
-->
<script lang="ts">
	import SnowFall from '../delight/SnowFall.svelte';

	let {
		title,
		subline,
		snow = false
	}: { title: string; subline?: string; snow?: boolean } = $props();
</script>

<header class="hero">
	{#if snow}<SnowFall count={6} />{/if}
	<h2>{title}</h2>
	{#if subline}<p>{subline}</p>{/if}
</header>

<style>
	.hero {
		position: relative;
		display: grid;
		gap: var(--gap-xs);
		padding-block: var(--gap-sm);
	}

	h2 {
		margin: 0;
		color: var(--text-strong);
		font-family: var(--font-display);
		font-size: var(--type-display-size);
		font-style: italic;
		font-weight: var(--type-display-weight);
		line-height: var(--type-display-leading);
	}

	p {
		margin: 0;
		color: var(--text-soft);
		font-family: var(--font-body);
		font-size: var(--type-body-size);
		line-height: var(--type-body-leading);
	}

	@media (min-width: 1024px) {
		h2 {
			font-size: var(--type-display-size-desktop);
		}
	}
</style>
