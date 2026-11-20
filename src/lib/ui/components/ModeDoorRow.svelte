<!--
	ModeDoorRow (DESIGN §7 ModeDoor, mockup "Course"): the course page's doors side by side in one
	row of equal columns, labelled for screen readers. Layout only; the doors style themselves. Four
	doors (Learn, Practice, Exam prep, Play) make a 2 × 2 grid on phones and one row from 768 px.
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

	@media (max-width: 767.98px) {
		.doors:has(> :global(:nth-child(4))) {
			grid-auto-flow: row;
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
