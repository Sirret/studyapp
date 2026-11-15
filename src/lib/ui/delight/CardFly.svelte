<!--
	Card fly (DESIGN §8 `card-fly`): wraps a flashcard. `fly` sends it off — "left" for Still
	learning, "right" for Know it — by translateX ±120% plus rotate ±12° over 350 ms, then calls
	`onflown`. A freshly shown card rises (`rise`: translateY 12 → 0, opacity 0 → 1); change `key`
	for each new card so the rise plays again. Under reduced motion the swap is instant and
	`onflown` still fires. The flying card ignores taps, so it can't be answered twice.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		key,
		fly = null,
		onflown,
		children
	}: {
		key: string | number;
		fly?: 'left' | 'right' | null;
		onflown?: () => void;
		children: Snippet;
	} = $props();

	$effect(() => {
		if (fly === null) return;
		const duration = Number.parseFloat(
			getComputedStyle(document.documentElement).getPropertyValue('--dur-card-fly')
		);
		// Reduced motion collapses the duration to 0, so no animationend would come.
		if (!(duration > 0)) onflown?.();
	});
</script>

{#key key}
	<div
		class="card-fly"
		class:left={fly === 'left'}
		class:right={fly === 'right'}
		onanimationend={(event) => {
			if (fly !== null && event.target === event.currentTarget) onflown?.();
		}}
	>
		{@render children()}
	</div>
{/key}

<style>
	.card-fly {
		animation: rise var(--dur-card-fly) var(--ease-out);
	}

	.left,
	.right {
		pointer-events: none;
		animation: fly var(--dur-card-fly) var(--ease-out) forwards;
	}

	.left {
		--fly-x: calc(var(--fly-distance) * -1);
		--fly-r: calc(var(--fly-tilt) * -1);
	}

	.right {
		--fly-x: var(--fly-distance);
		--fly-r: var(--fly-tilt);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(var(--rise-distance));
		}

		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes fly {
		to {
			transform: translateX(var(--fly-x)) rotate(var(--fly-r));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.card-fly {
			animation: none !important;
		}
	}
</style>
