<!--
	Import v2 checklist (PROMPTS §6): which topics of the course map this paste brings in, and what the
	chatbot couldn't read (@missing). Plain words, no codes; the counts say how far the course has got.
-->
<script lang="ts">
	import type { ChecklistItem } from '#lib/services/import-map.ts';
	import { countOf } from '#lib/util/plural.ts';
	import Stack from '../layout/Stack.svelte';

	interface Props {
		checklist: readonly ChecklistItem[];
		missing: readonly string[];
	}

	let { checklist, missing }: Props = $props();

	const importedCount = $derived(checklist.filter((item) => item.imported).length);

	function stateLabel(item: ChecklistItem): string {
		if (item.partial) return 'Imported, but the reply stopped inside it';
		return item.imported ? 'Imported' : 'Not in this paste yet';
	}
</script>

{#if checklist.length > 0}
	<Stack gap="sm">
		<h3>
			{importedCount} of {countOf(checklist.length, 'topic', 'topics')} imported
		</h3>
		<ul>
			{#each checklist as item (item.key)}
				<li>
					<strong>{item.title}</strong>
					<span class="muted">{stateLabel(item)}</span>
				</li>
			{/each}
		</ul>
	</Stack>
{/if}

{#if missing.length > 0}
	<Stack gap="sm">
		<h3>The chatbot couldn't read {countOf(missing.length, 'part', 'parts')}</h3>
		<ul>
			{#each missing as item (item)}
				<li>{item}</li>
			{/each}
		</ul>
	</Stack>
{/if}

<style>
	h3 {
		margin: 0;
		font-size: var(--type-body-size);
		font-weight: var(--type-strong-weight);
	}

	ul {
		margin: 0;
		padding-left: var(--space-20);
		display: grid;
		gap: var(--space-4);
	}

	.muted {
		color: var(--text-muted);
		font-size: var(--type-small-size);
	}
</style>
