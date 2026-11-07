<!--
	Top bar (DESIGN §4, §6): a row with a leading action (close or back), a title or middle content,
	and a trailing slot; an optional second line underneath (the session's progress strip).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		leading,
		middle,
		trailing,
		below
	}: { leading?: Snippet; middle?: Snippet; trailing?: Snippet; below?: Snippet } = $props();
</script>

<header class="bar">
	<div class="line">
		<div class="slot">
			{#if leading}{@render leading()}{/if}
		</div>
		<div class="middle">
			{#if middle}{@render middle()}{/if}
		</div>
		<div class="slot end">
			{#if trailing}{@render trailing()}{/if}
		</div>
	</div>
	{#if below}<div class="below">{@render below()}</div>{/if}
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

	.middle {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--gap-sm);
		min-width: 0;
	}

	.end {
		justify-self: end;
	}

	.below {
		padding: 0 var(--gap-xs) var(--gap-xs);
	}
</style>
