<!--
	Empty state (DESIGN §5): Yuki sniffing (96 px, hidden when Yuki is off), one line, one action.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Yuki from './yuki/Yuki.svelte';

	let {
		message,
		companion = true,
		action
	}: { message: string; companion?: boolean; action?: Snippet } = $props();
</script>

<div class="empty">
	{#if companion}<Yuki state="sniff" size={96} />{/if}
	<p>{message}</p>
	{#if action}{@render action()}{/if}
</div>

<style>
	.empty {
		display: grid;
		justify-items: center;
		gap: var(--gap-md);
		padding: var(--gap-2xl) var(--gap-lg);
		text-align: center;
	}

	p {
		margin: 0;
		color: var(--text-muted);
	}
</style>
