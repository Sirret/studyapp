<!--
	Progress dots (DESIGN §5): one dot per required correct this session, filled for counting
	corrects (●●○). Empties with a short fade after a wrong answer. Read as "2 of 3 correct".
-->
<script lang="ts">
	let { count, required }: { count: number; required: number } = $props();
</script>

<span class="dots" role="img" aria-label="{Math.min(count, required)} of {required} correct">
	{#each Array.from({ length: required }, (_unused, i) => i) as i (i)}
		<span class="dot" class:filled={i < count}></span>
	{/each}
</span>

<style>
	.dots {
		display: inline-flex;
		gap: var(--size-px-6);
	}

	.dot {
		width: var(--size-px-8);
		height: var(--size-px-8);
		border: var(--stroke) solid var(--primary-soft);
		border-radius: var(--r-pill);
		transition:
			background-color var(--dur-base) var(--ease-out),
			opacity var(--dur-base) var(--ease-out);
	}

	.filled {
		border-color: var(--primary);
		background: var(--primary);
	}
</style>
