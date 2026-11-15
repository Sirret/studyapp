<!-- Banner (DESIGN §7 palette): a passive sunk-paper strip — offline, update available, ready offline. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		tone = 'info',
		children,
		action
	}: { tone?: 'info' | 'success' | 'warning'; children: Snippet; action?: Snippet } = $props();
</script>

<div class="banner {tone}" role="status">
	<span class="text">{@render children()}</span>
	{#if action}{@render action()}{/if}
</div>

<style>
	.banner {
		--banner-bg: var(--surface-sunk);
		--banner-edge: var(--line-strong);
		--banner-style: solid;

		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap-md);
		min-height: var(--touch-min);
		padding: var(--gap-xs) var(--screen-gutter);
		border-bottom: var(--border-dashed) var(--banner-style) var(--banner-edge);
		background: var(--banner-bg);
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--type-small-size);
		font-weight: var(--type-small-weight);
	}

	.success {
		--banner-edge: var(--correct);
	}

	.warning {
		--banner-edge: var(--accent);
		--banner-style: dashed;
	}
</style>
