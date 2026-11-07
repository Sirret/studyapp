<!-- Banner (DESIGN §5): a passive top strip — offline, update available, ready offline. -->
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
		--banner-bg: var(--primary-soft);

		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap-md);
		min-height: var(--touch-min);
		padding: var(--gap-xs) var(--screen-gutter);
		background: var(--banner-bg);
		color: var(--text);
		font-size: var(--type-small-size);
		font-weight: var(--type-small-weight);
	}

	.success {
		--banner-bg: var(--success-soft);
	}

	.warning {
		--banner-bg: var(--warning-soft);
	}
</style>
