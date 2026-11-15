<!--
	Progress dots (DESIGN §7 PawTrail, compact): one paw per required correct this session, solid
	ink for counting corrects, a faint outline for the rest. Empties with a short fade after a wrong
	answer. Read as "2 of 3 correct".
-->
<script lang="ts">
	import Paw from '../primitives/Paw.svelte';

	let { count, required }: { count: number; required: number } = $props();
</script>

<span class="dots" role="img" aria-label="{Math.min(count, required)} of {required} correct">
	{#each Array.from({ length: required }, (_unused, i) => i) as i (i)}
		<span class="dot" class:filled={i < count}><Paw size={16} outline={i >= count} /></span>
	{/each}
</span>

<style>
	.dots {
		display: inline-flex;
		gap: var(--gap-xs);
	}

	.dot {
		color: var(--decor);
		transition: opacity var(--dur-base) var(--ease-out);
	}

	.filled {
		color: var(--text);
	}
</style>
