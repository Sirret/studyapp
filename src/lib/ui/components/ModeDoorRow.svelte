<!--
	ModeDoorRow (DESIGN §7 ModeDoor, mockup "Course"): the course page's doors side by side in one
	row of equal columns, labelled for screen readers. Layout only; the doors style themselves.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { label = 'Study modes', children }: { label?: string; children: Snippet } = $props();
</script>

<nav class="doors" aria-label={label}>{@render children()}</nav>

<style>
	.doors {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		gap: var(--gap-sm);
		align-items: stretch;
	}
</style>
