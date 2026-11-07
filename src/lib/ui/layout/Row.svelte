<!-- Row (DESIGN §13.2, layer 8): children side by side, wrapping, with a scale gap. Layout only. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		gap = 'sm',
		justify = 'start',
		children
	}: {
		gap?: 'xs' | 'sm' | 'md';
		justify?: 'start' | 'between' | 'center' | 'end';
		children: Snippet;
	} = $props();
</script>

<div class="row gap-{gap} justify-{justify}">{@render children()}</div>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
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

	.justify-between {
		justify-content: space-between;
	}

	.justify-center {
		justify-content: center;
	}

	.justify-end {
		justify-content: flex-end;
	}
</style>
