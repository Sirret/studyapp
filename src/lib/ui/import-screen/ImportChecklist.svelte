<!--
	Import v2 checklist (PROMPTS §6): which topics of the course map this paste brings in, and what the
	chatbot couldn't read (@missing). Plain words, no codes; the counts say how far the course has got.
	Cozy look (DESIGN §7 ChecklistRow, TrapAside; mockup "Import · preview"): a "Course map" heading,
	one PawRing row per topic with a Courier state on the right, and a "Couldn't read" trap box.
-->
<script lang="ts">
	import type { ChecklistItem } from '#lib/services/import-map.ts';
	import { countOf } from '#lib/util/plural.ts';
	import ChecklistRow from '../components/ChecklistRow.svelte';
	import type { RingState } from '../components/PawRing.svelte';
	import SectionHeading from '../components/SectionHeading.svelte';
	import TrapAside from '../components/TrapAside.svelte';
	import Stack from '../layout/Stack.svelte';

	interface Props {
		checklist: readonly ChecklistItem[];
		missing: readonly string[];
	}

	let { checklist, missing }: Props = $props();

	const importedCount = $derived(checklist.filter((item) => item.imported).length);

	function ringOf(item: ChecklistItem): RingState {
		if (item.partial) return 'current';
		return item.imported ? 'done' : 'todo';
	}

	function stateLabel(item: ChecklistItem): string {
		if (item.partial) return 'Imported, but the reply stopped inside it';
		return item.imported ? 'Imported' : 'Not in this paste yet';
	}

	function stateMeta(item: ChecklistItem): string {
		if (item.partial) return 'cut short';
		return item.imported ? 'imported' : 'to come';
	}
</script>

{#if checklist.length > 0}
	<Stack gap="xs">
		<SectionHeading title="Course map" />
		<h3 class="count">
			{importedCount} of {countOf(checklist.length, 'topic', 'topics')} imported
		</h3>
		<ul>
			{#each checklist as item (item.key)}
				<li>
					<ChecklistRow
						title={item.title}
						state={ringOf(item)}
						label={stateLabel(item)}
						meta={stateMeta(item)}
					/>
				</li>
			{/each}
		</ul>
	</Stack>
{/if}

{#if missing.length > 0}
	<TrapAside label="Couldn't read">
		<p>The chatbot couldn't read {countOf(missing.length, 'part', 'parts')}:</p>
		<ul class="missing">
			{#each missing as item (item)}
				<li>{item}</li>
			{/each}
		</ul>
	</TrapAside>
{/if}

<style>
	.count {
		margin: 0;
		color: var(--correct);
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	p {
		margin: 0;
	}

	.missing {
		display: grid;
		gap: var(--gap-2xs);
		padding-left: var(--gap-xl);
		list-style: disc;
	}
</style>
