<!-- A topic's heading and its rows in the "See all cards" list. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { countOf } from '#lib/util/plural.ts';
	import Stack from '../layout/Stack.svelte';

	let { name, count, children }: { name: string; count: number; children: Snippet } = $props();
</script>

<section aria-label={name}>
	<Stack gap="sm">
		<h2>{name} <span>{countOf(count, 'note')}</span></h2>
		{@render children()}
	</Stack>
</section>

<style>
	h2 {
		margin: 0;
		font-size: var(--type-heading-size);
		line-height: var(--type-heading-leading);
		font-weight: var(--type-heading-weight);
	}

	span {
		color: var(--text-muted);
		font-size: var(--type-small-size);
		font-weight: var(--type-body-weight);
	}
</style>
