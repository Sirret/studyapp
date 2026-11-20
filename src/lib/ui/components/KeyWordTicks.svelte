<!--
	Key-word ticks (Manual mode; Decisions log "Phase 8.6 Q15"): the definition's words as tap chips;
	tick the words a typed answer must contain. Neighbouring ticked words become one key phrase
	(`manual-fields.ts starTicked`). Tapping is the only input, so it works by touch at 360 px.
-->
<script lang="ts">
	import { wordsOf } from '#lib/services/manual-fields.ts';
	import TapChip from './TapChip.svelte';

	let {
		definition,
		ticked = $bindable([])
	}: {
		definition: string;
		/** Indexes of the ticked words in `wordsOf(definition)`. */
		ticked?: number[];
	} = $props();

	const words = $derived(wordsOf(definition));

	function toggle(index: number): void {
		ticked = ticked.includes(index) ? ticked.filter((i) => i !== index) : [...ticked, index];
	}
</script>

<div class="ticks" role="group" aria-label="Key words" data-key-word-ticks>
	{#each words as word, index (index)}
		<TapChip
			text={word}
			state={ticked.includes(index) ? 'selected' : 'default'}
			onclick={() => toggle(index)}
		/>
	{:else}
		<span class="empty">Write the definition first; its words appear here to tick.</span>
	{/each}
</div>

<style>
	.ticks {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap-xs);
	}

	.empty {
		color: var(--text-soft);
		font-size: var(--type-small-size);
	}
</style>
