<!--
	Snow burst (DESIGN §11.2): after a first-attempt correct, a few small snowflakes burst out from
	the check and fade. Place it over the element it bursts from; change `key` to play it again.
	Never blocks input (pointer-events: none); nothing under reduced motion.
-->
<script lang="ts">
	import Snowflake from '../motifs/Snowflake.svelte';

	let { key }: { key: number } = $props();

	const FLAKES = [
		{ x: -28, y: -22 },
		{ x: 26, y: -26 },
		{ x: -32, y: 12 },
		{ x: 30, y: 16 },
		{ x: 0, y: -34 }
	];
</script>

{#key key}
	<span class="burst" aria-hidden="true">
		{#each FLAKES as flake, i (i)}
			<span class="flake" style:--dx="{flake.x}px" style:--dy="{flake.y}px"
				><Snowflake size={12} /></span
			>
		{/each}
	</span>
{/key}

<style>
	.burst {
		position: absolute;
		inset: 50% auto auto 50%;
		pointer-events: none;
	}

	.flake {
		position: absolute;
		color: var(--primary);
		opacity: 0;
		animation: burst var(--dur-burst) var(--ease-out) var(--dur-check-draw) forwards;
	}

	@keyframes burst {
		0% {
			opacity: 1;
			transform: translate(0, 0) scale(0.5);
		}

		100% {
			opacity: 0;
			transform: translate(var(--dx), var(--dy)) scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.burst {
			display: none;
		}
	}
</style>
