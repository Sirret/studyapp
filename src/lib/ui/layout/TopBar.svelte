<!--
	Top bar (DESIGN §7 TopBar): 44 px icon-button slots either side (back, settings), the title in
	the middle — the IM Fell SC wordmark with `wordmark`, otherwise a Courier breadcrumb — or
	custom middle content, an optional second line (the session's progress), then the knit band.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		leading,
		title,
		wordmark = false,
		middle,
		trailing,
		below,
		knit = true
	}: {
		leading?: Snippet;
		title?: string;
		/** Shows the title as the wordmark ("Snowpack") instead of a breadcrumb. */
		wordmark?: boolean;
		middle?: Snippet;
		trailing?: Snippet;
		below?: Snippet;
		knit?: boolean;
	} = $props();
</script>

<header class="top">
	<div class="bar">
		<div class="line">
			<div class="slot">
				{#if leading}{@render leading()}{/if}
			</div>
			<div class="middle">
				{#if title}<h1 class:wordmark>{title}</h1>{/if}
				{#if middle}{@render middle()}{/if}
			</div>
			<div class="slot end">
				{#if trailing}{@render trailing()}{/if}
			</div>
		</div>
		{#if below}<div class="below">{@render below()}</div>{/if}
	</div>
	{#if knit}<div class="knit" aria-hidden="true"></div>{/if}
</header>

<style>
	.bar {
		display: grid;
		gap: var(--gap-xs);
		max-width: var(--content-max);
		margin: 0 auto;
		padding: var(--gap-sm) var(--screen-gutter);
	}

	.line {
		display: grid;
		grid-template-columns: var(--touch-min) 1fr var(--touch-min);
		align-items: center;
		gap: var(--gap-sm);
		min-height: var(--touch-min);
	}

	.slot {
		display: grid;
		place-items: center;
		min-width: var(--touch-min);
		min-height: var(--touch-min);
	}

	.middle {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--gap-sm);
		min-width: 0;
	}

	h1 {
		margin: 0;
		overflow-wrap: anywhere;
		color: var(--text);
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		line-height: var(--type-caption-leading);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking-wide);
		text-align: center;
		text-transform: uppercase;
	}

	h1.wordmark {
		color: var(--text-strong);
		font-family: var(--font-wordmark);
		font-size: var(--type-wordmark-size);
		font-weight: var(--type-heading-weight);
		letter-spacing: var(--type-wordmark-tracking);
		text-transform: none;
	}

	.below {
		padding: 0 var(--gap-xs) var(--gap-xs);
	}
</style>
