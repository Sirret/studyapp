<!-- One labelled row of examples inside a style-guide section. Dev builds only. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { label, children }: { label: string; children: Snippet } = $props();
</script>

<div class="row">
	<span class="label">{label}</span>
	<div class="items">{@render children()}</div>
</div>

<style>
	.row {
		display: grid;
		gap: var(--gap-sm);
	}

	.label {
		color: var(--text-muted);
		font-size: var(--type-small-size);
		font-weight: var(--type-small-weight);
	}

	.items {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--gap-sm);
	}
</style>
