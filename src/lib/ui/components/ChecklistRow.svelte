<!--
	Checklist row (DESIGN §7; import map, scope picker): a PawRing plus a title on a 44 px row, then
	an indented list of sections with their own small rings. With `onclick` the head is a button.
	`meta` is a short Courier note on the right (e.g. "to come"); `label` names the ring's state.
-->
<script lang="ts">
	import PawRing, { type RingState } from './PawRing.svelte';

	type Section = { title: string; state: RingState };

	let {
		title,
		state,
		sections = [],
		meta,
		label,
		onclick
	}: {
		title: string;
		state: RingState;
		sections?: Section[];
		meta?: string;
		label?: string;
		onclick?: () => void;
	} = $props();
</script>

<div class="row">
	{#if onclick}
		<button type="button" class="head" {onclick}>
			<PawRing {state} {label} /><span class="title">{title}</span>
			{#if meta}<span class="meta">{meta}</span>{/if}
		</button>
	{:else}
		<div class="head">
			<PawRing {state} {label} /><span class="title">{title}</span>
			{#if meta}<span class="meta">{meta}</span>{/if}
		</div>
	{/if}
	{#if sections.length > 0}
		<ul class="sections">
			{#each sections as section, i (i)}
				<li><PawRing state={section.state} small /><span>{section.title}</span></li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.row {
		display: grid;
		gap: var(--gap-2xs);
	}

	.head {
		display: flex;
		align-items: center;
		gap: var(--gap-md);
		width: 100%;
		min-height: var(--touch-min);
		padding: 0;
		border: none;
		background: none;
		color: var(--text);
		font: inherit;
		text-align: start;
	}

	button.head {
		cursor: pointer;
	}

	.title {
		flex: 1;
		font-size: var(--type-body-size);
		font-weight: var(--type-button-weight);
	}

	.meta {
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		letter-spacing: var(--type-label-tracking);
		white-space: nowrap;
	}

	.sections {
		display: grid;
		gap: var(--gap-xs);
		margin: 0;
		padding: 0 0 var(--gap-xs) calc(var(--ring-size) + var(--gap-md));
		list-style: none;
	}

	.sections li {
		display: flex;
		align-items: center;
		gap: var(--gap-sm);
		color: var(--text-soft);
		font-size: var(--type-small-size);
		line-height: var(--type-small-leading);
	}
</style>
