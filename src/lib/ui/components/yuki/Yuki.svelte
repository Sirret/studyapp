<!--
	Yuki, the white wolf pup (DESIGN §9), built from docs/design/yuki-cozy.svg and keeping its group
	ids (#tail #body #head #ear-l #ear-r #eyes #bandana #zz). States move only those groups, by
	transform/opacity: idle breathes and wags, happy wags up and hops, thinking tilts an ear and
	blinks, sleepy breathes slowly with eyes nearly shut and a drifting zz, celebrate is happy plus a
	paw stamp nearby. `still` holds the pose (one play of a reaction, no idle loop): the session
	header and the "quiet" setting. Reduced motion shows the static pose. Decorative: aria-hidden.
-->
<script lang="ts">
	import type { YukiState } from './yuki.ts';
	import './yuki-motion.css';
	import PawStamp from '../../delight/PawStamp.svelte';
	import Paw from '../../primitives/Paw.svelte';

	let {
		state = 'idle',
		size = 96,
		still = false
	}: { state?: YukiState; size?: number; still?: boolean } = $props();

	const STAMP_SHARE = 0.3;
</script>

<span
	class="yuki s-{state}"
	class:still
	aria-hidden="true"
	style:--yuki-size="{size}px"
	data-yuki-state={state}
>
	<svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true" focusable="false">
		<g id="body">
			<g id="tail">
				<path
					class="snow ink"
					d="M124,176 C162,186 192,158 184,120 C180,100 162,92 152,104 C149,110 152,116 158,118 C166,132 162,154 128,158 Z"
				/>
				<path
					class="frost-deep"
					d="M182,112 C176,98 162,94 154,104 C153,110 155,114 160,116 C168,116 176,120 183,127 Z"
				/>
			</g>
			<g class="ink">
				<path class="snow" d="M72,122 C64,140 62,168 70,183 L130,183 C138,168 136,140 128,122 Z" />
				<ellipse class="paw" cx="86" cy="183" rx="13" ry="8" />
				<ellipse class="paw" cx="114" cy="183" rx="13" ry="8" />
			</g>
			<g id="head" class="ink">
				<g id="ear-l">
					<path class="snow" d="M64,66 L55,20 Q57,13 64,17 L96,46 Z" />
					<path class="blush bare" d="M67,58 L61,28 L87,48 Z" />
				</g>
				<g id="ear-r">
					<path class="snow" d="M136,66 L145,20 Q143,13 136,17 L104,46 Z" />
					<path class="blush bare" d="M133,58 L139,28 L113,48 Z" />
				</g>
				<path
					class="snow"
					d="M60,70 C60,48 80,40 100,40 C120,40 140,48 140,70 C146,78 152,86 150,94 L162,100 L148,104 L158,114 L140,116 C132,128 116,131 100,131 C84,131 68,128 60,116 L42,114 L52,104 L38,100 L50,94 C48,86 54,78 60,70 Z"
				/>
				<path
					class="frost bare"
					d="M63,70 C63,52 81,43 100,43 C119,43 137,52 137,70 C131,64 121,66 113,74 L100,86 L87,74 C79,66 69,64 63,70 Z"
				/>
				<g id="eyes" class="bare">
					<ellipse class="pupil" cx="80" cy="91" rx="9" ry="11" />
					<ellipse class="pupil" cx="120" cy="91" rx="9" ry="11" />
					<circle class="snow" cx="77" cy="87" r="3.2" />
					<circle class="snow" cx="117" cy="87" r="3.2" />
				</g>
				<ellipse class="blush bare" cx="68" cy="106" rx="7" ry="4" />
				<ellipse class="blush bare" cx="132" cy="106" rx="7" ry="4" />
				<path
					class="pupil"
					d="M94.5,104 Q100,100.5 105.5,104 Q103.5,109.5 100,110.5 Q96.5,109.5 94.5,104 Z"
				/>
				<path class="mouth" d="M90,113 Q95,123 100,114 Q105,123 110,113" />
			</g>
			<g id="bandana" class="ink">
				<path
					class="bandana"
					d="M68,122 C84,133 116,133 132,122 L134,134 C116,145 84,145 66,134 Z"
				/>
				<path class="bandana" d="M108,138 L118,168 L104,170 L100,140 Z" />
				<path
					class="stitch"
					d="M76,128 l3,6 M88,131 l3,6 M100,132 l3,6 M112,131 l3,6 M124,128 l3,6"
				/>
			</g>
		</g>
		<!-- Drawn, not <text>: some screen readers voice SVG text even when hidden (UX fix). -->
		<g id="zz">
			<path class="z" d="M150,28 h11 l-11,12 h11" />
			<path class="z" d="M163,17 h8 l-8,9 h8" />
		</g>
	</svg>
	{#if state === 'celebrate'}
		<span class="stamp"><PawStamp><Paw size={Math.round(size * STAMP_SHARE)} /></PawStamp></span>
	{/if}
</span>

<style>
	.yuki {
		position: relative;
		display: block;
		flex: none;
		width: var(--yuki-size);
		height: var(--yuki-size);
	}

	svg {
		display: block;
		overflow: visible;
	}

	svg :global(g) {
		transform-box: fill-box;
	}

	.ink {
		stroke: var(--yuki-ink);
		stroke-width: 4;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.bare {
		stroke: none;
	}

	.snow {
		fill: var(--yuki-snow);
	}

	.frost {
		fill: var(--yuki-frost);
	}

	.frost-deep {
		fill: var(--yuki-frost-deep);
	}

	.paw {
		fill: var(--yuki-paw);
	}

	.blush {
		fill: var(--yuki-blush);
	}

	.pupil {
		fill: var(--yuki-ink);
	}

	.mouth {
		fill: none;
		stroke-width: 3;
	}

	.bandana {
		fill: var(--yuki-bandana);
	}

	.stitch {
		fill: none;
		stroke: var(--yuki-stitch);
		stroke-width: 2;
	}

	.z {
		fill: none;
		stroke: var(--text-soft);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.stamp {
		position: absolute;
		inset: 0 0 auto auto;
		color: var(--accent);
	}

	/* Transform origins from yuki-cozy.svg */
	#tail {
		transform-origin: 4% 85%;
	}

	#body {
		transform-origin: 50% 100%;
	}

	#ear-l {
		transform-origin: 70% 90%;
	}

	#ear-r {
		transform-origin: 30% 90%;
	}

	#eyes {
		transform-origin: 50% 50%;
	}

	#zz {
		opacity: 0;
	}

	/* idle: breathe + slow wag */
	.s-idle #body {
		animation: yuki-breathe var(--dur-yuki-breathe) ease-in-out infinite;
	}

	.s-idle #tail {
		animation: yuki-wag var(--dur-yuki-wag) ease-in-out infinite;
	}

	/* happy and celebrate: wag up + hop */
	.s-happy #tail,
	.s-celebrate #tail {
		animation: yuki-wagup var(--dur-yuki-hop) ease-in-out infinite alternate;
	}

	.s-happy #body,
	.s-celebrate #body {
		animation: yuki-hop calc(var(--dur-yuki-hop) * 2) var(--ease-out) infinite;
	}

	/* thinking: one ear tilts, blink */
	.s-thinking #ear-r {
		animation: yuki-ear var(--dur-yuki-ear) ease-in-out infinite;
	}

	.s-thinking #eyes {
		animation: yuki-blink var(--dur-yuki-blink) infinite;
	}

	/* sleepy: slow breathe, eyes nearly shut, zz drifting up */
	.s-sleepy #body {
		animation: yuki-breathe var(--dur-yuki-sleepy) ease-in-out infinite;
	}

	.s-sleepy #eyes {
		transform: scaleY(0.15);
	}

	.s-sleepy #zz {
		opacity: 1;
		animation: yuki-zz var(--dur-yuki-zz) ease-out infinite;
	}

	/* still: a reaction plays once; idle doesn't move at all */
	.still :global(*) {
		animation-iteration-count: 1;
	}

	.still.s-idle :global(*) {
		animation: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.yuki :global(*) {
			animation: none !important;
		}
	}
</style>
