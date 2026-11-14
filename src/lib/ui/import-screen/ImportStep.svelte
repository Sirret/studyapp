<!--
	One numbered step of the import screen (BUILD_PLAN §10 row 8.5, "numbered steps"): a card with
	a step number and a short title, so the screen reads top to bottom as 1, 2, 3, 4.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Stack from '../layout/Stack.svelte';
	import Card from '../primitives/Card.svelte';

	let { step, title, children }: { step: number; title: string; children: Snippet } = $props();
</script>

<Card tag="section" label={title}>
	<Stack gap="md">
		<h2><span aria-hidden="true">{step}</span>{title}</h2>
		{@render children()}
	</Stack>
</Card>

<style>
	h2 {
		display: flex;
		align-items: center;
		gap: var(--gap-sm);
		margin: 0;
		font-size: var(--type-body-size);
		font-weight: var(--type-strong-weight);
	}

	span {
		display: inline-grid;
		place-items: center;
		width: var(--chip-height);
		height: var(--chip-height);
		border-radius: var(--r-pill);
		background: var(--primary-soft);
		color: var(--primary);
		font-size: var(--type-small-size);
	}
</style>
