<!--
	Section heading (DESIGN §5 "small headings"): IM Fell SC title, a dashed `--decor` rule filling
	the line, and an optional trailing action (e.g. "+ Add" on Home's "Your shelf"). `id` makes it
	a link target.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, id, action }: { title: string; id?: string; action?: Snippet } = $props();
</script>

<div class="heading">
	<h2 {id}>{title}</h2>
	<span class="rule" aria-hidden="true"></span>
	{#if action}{@render action()}{/if}
</div>

<style>
	.heading {
		display: flex;
		align-items: center;
		gap: var(--gap-md);
		min-height: var(--touch-min);
	}

	h2 {
		margin: 0;
		color: var(--text-strong);
		font-family: var(--font-wordmark);
		font-size: var(--type-heading-size);
		font-weight: var(--type-heading-weight);
		line-height: var(--type-heading-leading);
		letter-spacing: var(--type-heading-tracking);
		scroll-margin-top: var(--gap-2xl);
	}

	.rule {
		flex: 1;
		border-top: var(--border-dashed) dashed var(--decor);
	}
</style>
