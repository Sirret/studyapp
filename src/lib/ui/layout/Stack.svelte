<!-- Stack (DESIGN §13.2, layer 8): children in a column with a spacing-scale gap. Layout only. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		gap = 'md',
		align = 'stretch',
		children
	}: {
		gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
		align?: 'stretch' | 'start' | 'center';
		children: Snippet;
	} = $props();
</script>

<div class="stack gap-{gap} align-{align}">{@render children()}</div>

<style>
	.stack {
		display: grid;
		min-width: 0;
	}

	.gap-xs {
		gap: var(--gap-xs);
	}

	.gap-sm {
		gap: var(--gap-sm);
	}

	.gap-md {
		gap: var(--gap-md);
	}

	.gap-lg {
		gap: var(--gap-lg);
	}

	.gap-xl {
		gap: var(--gap-xl);
	}

	.align-start {
		justify-items: start;
	}

	.align-center {
		justify-items: center;
		text-align: center;
	}
</style>
