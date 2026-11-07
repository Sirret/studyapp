<!--
	Paw stamp (DESIGN §11.2): wraps a status badge the moment a card reaches Exam-ready or Long-term
	secure, so it lands like a stamp (scale 1.3 → 1, rotate −8° → 0°). Static when `play` is false.
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
		animation: stamp var(--dur-paw-press) var(--ease-bounce);
	}

	@keyframes stamp {
		from {
			opacity: 0.4;
			transform: scale(1.3) rotate(-8deg);
		}

		to {
			opacity: 1;
			transform: scale(1) rotate(0);
		}
	}
</style>
