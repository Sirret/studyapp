<!--
	Grid (DESIGN §4, §13.2): one column on phones; two columns from 1024 px when `columns` is 2
	(Today and Planner). Layout only.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { columns = 1, children }: { columns?: 1 | 2; children: Snippet } = $props();
</script>

<div class="grid cols-{columns}">{@render children()}</div>

<style>
	.grid {
		display: grid;
		gap: var(--card-gap);
		min-width: 0;
	}

	@media (min-width: 1024px) {
		.cols-2 {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
