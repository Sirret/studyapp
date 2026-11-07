<!--
	Sticky note (DESIGN §5, §12): warnings that need a decision — a slightly rotated note with a
	tape strip, a Caveat heading and a Nunito body. Never alarmist; no exclamation marks.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children, actions }: { title: string; children: Snippet; actions?: Snippet } =
		$props();
</script>

<aside class="note" role="note">
	<span class="tape" aria-hidden="true"></span>
	<h3>{title}</h3>
	<div class="body">{@render children()}</div>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</aside>

<style>
	.note {
		position: relative;
		display: grid;
		gap: var(--gap-sm);
		padding: var(--gap-xl) var(--gap-lg) var(--gap-lg);
		border-radius: var(--r-sm);
		background: var(--warning-soft);
		color: var(--text);
		box-shadow: var(--shadow-1);
		transform: rotate(-1.5deg);
	}

	.tape {
		position: absolute;
		top: calc(var(--size-px-8) * -1);
		left: 50%;
		width: var(--size-px-64);
		height: var(--size-px-20);
		background: var(--tape);
		transform: translateX(-50%) rotate(2deg);
	}

	h3 {
		margin: 0;
		font-family: var(--font-hand);
		font-size: var(--type-hand-size);
		line-height: var(--type-title-leading);
		font-weight: var(--type-caption-weight);
	}

	.body {
		font-size: var(--type-body-size);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap-sm);
	}
</style>
