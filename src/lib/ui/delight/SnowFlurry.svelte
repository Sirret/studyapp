<!--
	Snow flurry (DESIGN §11.2): after 3 first-attempt corrects in a row, about ten flakes drift down
	across the top of the card. Change `key` to play it again. Never blocks input; nothing under
	reduced motion.
-->
<script lang="ts">
	import Snowflake from '../motifs/Snowflake.svelte';

	let { key }: { key: number } = $props();

	const FLAKES = Array.from({ length: 10 }, (_unused, i) => ({
		left: 5 + i * 9.5,
		delay: (i % 4) * 60,
		size: 10 + (i % 3) * 3
	}));
</script>

{#key key}
	<div class="flurry" aria-hidden="true" data-flurry={key}>
		{#each FLAKES as flake, i (i)}
			<span class="flake" style:left="{flake.left}%" style:animation-delay="{flake.delay}ms">
				<Snowflake size={flake.size} />
			</span>
		{/each}
	</div>
{/key}

<style>
	.flurry {
		position: absolute;
		inset: 0 0 auto;
		height: var(--space-56);
		overflow: hidden;
		pointer-events: none;
	}

	.flake {
		position: absolute;
		top: 0;
		color: var(--primary);
		opacity: 0;
		animation: drift var(--dur-flurry) var(--ease-out) forwards;
	}

	@keyframes drift {
		0% {
			opacity: 0;
			transform: translateY(calc(var(--space-12) * -1)) rotate(0);
		}

		30% {
			opacity: 0.9;
		}

		100% {
			opacity: 0;
			transform: translateY(var(--space-40)) rotate(90deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.flurry {
			display: none;
		}
	}
</style>
