<!--
	Paw walk (DESIGN §11.2): once per session summary, a line of paw prints walks across the bottom
	of the card towards Yuki. Decorative; nothing under reduced motion.
-->
<script lang="ts">
	import Paw from '../motifs/Paw.svelte';

	const STEPS = 7;
	const STEP_DELAY_MS = 150;
</script>

<div class="walk" aria-hidden="true">
	{#each Array.from({ length: STEPS }, (_unused, i) => i) as i (i)}
		<span
			class="print"
			class:up={i % 2 === 0}
			style:left="{6 + i * 13}%"
			style:animation-delay="{i * STEP_DELAY_MS}ms"
		>
			<Paw size={16} />
		</span>
	{/each}
</div>

<style>
	.walk {
		position: absolute;
		inset: auto 0 var(--space-8);
		height: var(--space-32);
		pointer-events: none;
	}

	.print {
		position: absolute;
		bottom: 0;
		color: var(--primary);
		opacity: 0;
		animation: step var(--dur-walk) var(--ease-out) forwards;
		transform: rotate(90deg);
	}

	.up {
		bottom: var(--space-12);
	}

	@keyframes step {
		0% {
			opacity: 0;
		}

		20%,
		70% {
			opacity: 0.5;
		}

		100% {
			opacity: 0.25;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.walk {
			display: none;
		}
	}
</style>
