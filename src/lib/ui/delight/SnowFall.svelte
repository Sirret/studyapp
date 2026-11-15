<!--
	Snow fall (DESIGN §8 `fall`): ambient snow for Welcome, Home and empty states. At most eight
	flakes drift down (translateY −20 → 110 px, opacity 0 → 1 → .2) over 9 s, linear, forever,
	with staggered delays. Fills its positioned parent, never takes input, hidden under reduced motion.
-->
<script lang="ts">
	import Snowflake from '../primitives/Snowflake.svelte';

	let { count = 8 }: { count?: number } = $props();

	const MAX_FLAKES = 8;
	const flakes = $derived.by(() => {
		const n = Math.max(1, Math.min(count, MAX_FLAKES));
		// Spread across the width, each a share of one fall ahead of the last (staggered delays).
		return Array.from({ length: n }, (_unused, i) => ({
			left: 6 + ((i * 37) % 88),
			lead: i / n,
			size: 8 + (i % 3) * 2
		}));
	});
</script>

<div class="fall" aria-hidden="true">
	{#each flakes as flake, i (i)}
		<span
			class="flake"
			style:left="{flake.left}%"
			style:animation-delay="calc(var(--dur-fall) * -{flake.lead})"
		>
			<Snowflake size={flake.size} />
		</span>
	{/each}
</div>

<style>
	.fall {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}

	.flake {
		position: absolute;
		top: 0;
		color: var(--decor);
		opacity: 0;
		animation: fall var(--dur-fall) var(--ease-linear) infinite;
	}

	@keyframes fall {
		0% {
			opacity: 0;
			transform: translateY(var(--fall-from));
		}

		15% {
			opacity: 1;
		}

		100% {
			opacity: 0.2;
			transform: translateY(var(--fall-to));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.fall {
			display: none;
		}

		.flake {
			animation: none !important;
		}
	}
</style>
