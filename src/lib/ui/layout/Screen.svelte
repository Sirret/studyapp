<!--
	Screen (DESIGN §4): the page frame — content up to 560 px wide and centred, 16 px gutters,
	safe-area insets, room for the bottom nav or a pinned action. Screens put their content in it
	and need no styles of their own. A `side` snippet (the Sidebar) shows from 1024 px as a sticky
	260 px column beside the screen, the pair centred up to 1280 px (DESIGN §10); below that it is
	not shown and the BottomNav carries the navigation.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		top,
		bottom,
		side,
		nav = false,
		wide = false,
		children
	}: {
		top?: Snippet;
		bottom?: Snippet;
		side?: Snippet;
		nav?: boolean;
		wide?: boolean;
		children: Snippet;
	} = $props();
</script>

<div class="page">
	{#if side}<aside class="side">{@render side()}</aside>{/if}
	<div class="screen" class:nav class:wide>
		{#if top}<div class="top">{@render top()}</div>{/if}
		<main class="content">{@render children()}</main>
		{#if bottom}<div class="bottom">{@render bottom()}</div>{/if}
	</div>
</div>

<style>
	.page {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		width: 100%;
		max-width: var(--page-max);
		margin: 0 auto;
	}

	.side {
		display: none;
	}

	@media (min-width: 1024px) {
		.side {
			display: block;
			position: sticky;
			top: 0;
			flex: 0 0 var(--sidebar-width);
			height: 100dvh;
		}
	}

	.screen {
		flex: 1 1 0;
		min-width: 0;
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

	/* From 1024 px the BottomNav hides (the Sidebar takes over), so no room is kept for it. */
	@media (min-width: 1024px) {
		.nav .content {
			padding-bottom: var(--gap-xl);
		}
	}
</style>
