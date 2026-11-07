<!--
	Screen (DESIGN §4): the page frame — content up to 560 px wide and centred, 16 px gutters,
	safe-area insets, room for the bottom nav or a pinned action. Screens put their content in it
	and need no styles of their own.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		top,
		bottom,
		nav = false,
		wide = false,
		children
	}: {
		top?: Snippet;
		bottom?: Snippet;
		nav?: boolean;
		wide?: boolean;
		children: Snippet;
	} = $props();
</script>

<div class="screen" class:nav class:wide>
	{#if top}<div class="top">{@render top()}</div>{/if}
	<main class="content">{@render children()}</main>
	{#if bottom}<div class="bottom">{@render bottom()}</div>{/if}
</div>

<style>
	.screen {
		display: grid;
		grid-template-rows: auto 1fr auto;
		min-height: 100dvh;
		padding-top: env(safe-area-inset-top);
	}

	.top {
		position: sticky;
		top: 0;
		z-index: var(--z-sticky);
		background: var(--bg);
	}

	.content {
		display: grid;
		align-content: start;
		gap: var(--card-gap);
		width: 100%;
		max-width: var(--content-max);
		margin: 0 auto;
		padding: var(--gap-lg) var(--screen-gutter) var(--gap-xl);
	}

	.wide .content {
		max-width: none;
	}

	@media (min-width: 1024px) {
		.wide .content {
			max-width: calc(var(--content-max) * 2);
		}
	}

	.bottom {
		position: sticky;
		bottom: 0;
		z-index: var(--z-sticky);
		width: 100%;
		max-width: var(--content-max);
		margin: 0 auto;
		padding: var(--gap-md) var(--screen-gutter) calc(var(--gap-md) + env(safe-area-inset-bottom));
		background: var(--bg);
	}

	.nav .content {
		padding-bottom: calc(var(--nav-height) + var(--gap-xl) + env(safe-area-inset-bottom));
	}
</style>
