<!--
	Disclosure: a one-line summary that folds out into details, for information most people never
	need (skipped lines, sections covered). A native <details>, so it works by keyboard and touch.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { summary, children }: { summary: string; children: Snippet } = $props();
</script>

<details class="disclosure">
	<summary>{summary}</summary>
	<div class="body">{@render children()}</div>
</details>

<style>
	.disclosure {
		border-radius: var(--r-md);
		background: var(--surface-alt);
	}

	summary {
		display: flex;
		align-items: center;
		min-height: var(--touch-min);
		padding: 0 var(--gap-md);
		color: var(--text);
		font-size: var(--type-small-size);
		font-weight: var(--type-strong-weight);
		cursor: pointer;
	}

	.body {
		display: grid;
		gap: var(--gap-xs);
		padding: 0 var(--gap-md) var(--gap-md);
		color: var(--text-muted);
		font-size: var(--type-small-size);
		overflow-wrap: anywhere;
	}
</style>
