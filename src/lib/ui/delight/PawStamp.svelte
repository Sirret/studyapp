<!--
	Stamp landing (DESIGN §8 `stamp`): wraps whatever lands like a stamp — a card reaching
	exam-ready, "Know it", Yuki's celebrate paw. Scale 1.7 → .9 → 1 with rotate −20° → −8°,
	opacity 0 → 1, about 450 ms; it rests at −8°. Static (no tilt) when `play` is false.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { play = true, children }: { play?: boolean; children: Snippet } = $props();
</script>

<span class="stamp" class:play>{@render children()}</span>

<style>
	.stamp {
		display: inline-flex;
	}

	.play {
		transform: rotate(var(--stamp-land));
		animation: stamp var(--dur-stamp) var(--ease-out) both;
	}

	@keyframes stamp {
		from {
			opacity: 0;
			transform: scale(var(--stamp-scale-from)) rotate(var(--stamp-from));
		}

		60% {
			opacity: 1;
			transform: scale(var(--stamp-overshoot)) rotate(var(--stamp-land));
		}

		to {
			opacity: 1;
			transform: scale(1) rotate(var(--stamp-land));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.play {
			animation: none !important;
		}
	}
</style>
