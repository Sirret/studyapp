<!--
	A topic's heading and its rows in the "See all cards" list: a SectionHeading (DESIGN §5) with
	the note count as a Courier label at the end of the rule.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { countOf } from '#lib/util/plural.ts';
	import SectionHeading from '../components/SectionHeading.svelte';
	import Stack from '../layout/Stack.svelte';

	let { name, count, children }: { name: string; count: number; children: Snippet } = $props();
</script>

<section aria-label={name}>
	<Stack gap="sm">
		<SectionHeading title={name}>
			{#snippet action()}<span class="count">{countOf(count, 'note')}</span>{/snippet}
		</SectionHeading>
		{@render children()}
	</Stack>
</section>

<style>
	.count {
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking);
		text-transform: uppercase;
		white-space: nowrap;
	}
</style>
