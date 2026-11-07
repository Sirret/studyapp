<!--
	Yuki's props (DESIGN §7.2): small separate groups shown per state — sparkles, snowflakes, zzz,
	a book, a sticky note. Rendered inside Yuki's SVG.
-->
<script lang="ts">
	import type { YukiState } from './yuki.ts';

	let { state }: { state: YukiState } = $props();
</script>

{#if state === 'sparkle'}
	<g class="sparkles">
		<path class="gold" d="M30,40 l4,10 l10,4 l-10,4 l-4,10 l-4,-10 l-10,-4 l10,-4z" />
		<path class="lilac" d="M168,30 l3,7 l7,3 l-7,3 l-3,7 l-3,-7 l-7,-3 l7,-3z" />
	</g>
{:else if state === 'celebrate'}
	<g class="sparkles">
		<path class="flake" d="M30,30 v24 M18,42 h24 M22,34 l16,16 M38,34 l-16,16" />
		<path class="flake" d="M170,24 v18 M161,33 h18 M164,27 l12,12 M176,27 l-12,12" />
		<path class="gold" d="M168,80 l3,7 l7,3 l-7,3 l-3,7 l-3,-7 l-7,-3 l7,-3z" />
	</g>
{:else if state === 'sleepy'}
	<g class="zzz">
		<text x="150" y="40" class="z" font-size="22">z</text>
		<text x="166" y="22" class="z" font-size="15">z</text>
	</g>
{:else if state === 'read'}
	<g class="book">
		<path class="cover" d="M70,150 L100,156 L130,150 L130,176 L100,182 L70,176 Z" />
		<path class="page" d="M100,156 L100,182" />
	</g>
{:else if state === 'worried-kind'}
	<g class="note">
		<rect
			class="paper"
			x="118"
			y="140"
			width="34"
			height="34"
			rx="3"
			transform="rotate(-8 135 157)"
		/>
		<path class="lines" d="M124,152 h20 M125,160 h16" transform="rotate(-8 135 157)" />
	</g>
{/if}

<style>
	.gold {
		fill: var(--yuki-sparkle);
	}

	.lilac {
		fill: var(--yuki-sparkle-alt);
	}

	.flake {
		fill: none;
		stroke: var(--yuki-iris);
		stroke-width: 3;
		stroke-linecap: round;
	}

	.sparkles {
		transform-origin: 50% 50%;
		animation: twinkle var(--dur-yuki-twinkle) ease-in-out 3;
	}

	.z {
		fill: var(--yuki-zzz);
		font-family: var(--font-body);
		font-weight: var(--type-display-weight);
	}

	.zzz {
		animation: float var(--dur-yuki-float) ease-in-out infinite;
	}

	.cover {
		fill: var(--yuki-book);
		stroke: var(--yuki-outline);
		stroke-width: 3;
		stroke-linejoin: round;
	}

	.page,
	.lines {
		fill: none;
		stroke: var(--yuki-outline);
		stroke-width: 2;
		stroke-linecap: round;
	}

	.paper {
		fill: var(--yuki-note);
		stroke: var(--yuki-outline);
		stroke-width: 2.5;
	}

	@keyframes twinkle {
		0%,
		100% {
			opacity: 0.3;
			transform: scale(0.8);
		}

		50% {
			opacity: 1;
			transform: scale(1.1);
		}
	}

	@keyframes float {
		0%,
		100% {
			opacity: 0.6;
			transform: translateY(0);
		}

		50% {
			opacity: 1;
			transform: translateY(-6px);
		}
	}
</style>
