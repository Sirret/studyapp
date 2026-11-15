<!--
	Sticky note (DESIGN §7 HangingTag look): warnings that need a decision, a slightly rotated kraft
	note with a 2 px outline, a small-caps heading and a Literata body. Never alarmist; no exclamation marks.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children, actions }: { title: string; children: Snippet; actions?: Snippet } =
		$props();
</script>

<aside class="note" role="note">
	<h3>{title}</h3>
	<div class="body">{@render children()}</div>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</aside>

<style>
	.note {
		position: relative;
		display: grid;
		gap: var(--gap-sm);
		padding: var(--gap-lg);
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-sm);
		background: var(--surface-tag);
		color: var(--text);
		font-family: var(--font-body);
		box-shadow: var(--shadow-raised);
		transform: rotate(calc(var(--stamp-tilt) / 2));
	}

	h3 {
		margin: 0;
		color: var(--text-strong);
		font-family: var(--font-wordmark);
		font-size: var(--type-heading-size);
		line-height: var(--type-heading-leading);
		font-weight: var(--type-heading-weight);
		letter-spacing: var(--type-heading-tracking);
	}

	.body {
		font-size: var(--type-body-size);
		line-height: var(--type-body-leading);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap-sm);
	}
</style>
