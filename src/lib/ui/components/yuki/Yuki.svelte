<!--
	Yuki, the snow wolf companion (DESIGN §7). Built from docs/design/wolf.svg, keeping its named
	groups (#tail, #body, #head with #ear-l, #ear-r, #eyes); moods come from eye swaps, part
	rotations and small props, never new drawings. Motion is CSS on transform/opacity only, and
	reduced motion shows the static pose. Decorative: always aria-hidden.
	`still` holds the pose without idle motion (the session header between reactions, §7.3).
-->
<script lang="ts">
	import type { YukiState } from './yuki.ts';
	import './yuki-motion.css';
	import YukiProps from './YukiProps.svelte';

	let {
		state = 'idle',
		size = 96,
		still = false
	}: { state?: YukiState; size?: number; still?: boolean } = $props();

	const eyes = $derived(
		state === 'celebrate' || state === 'sparkle' ? 'happy' : state === 'sleepy' ? 'closed' : 'open'
	);
</script>

<svg
	class="yuki s-{state}"
	class:still
	viewBox="0 0 200 200"
	width={size}
	height={size}
	aria-hidden="true"
	focusable="false"
	data-yuki-state={state}
>
	<g id="tail">
		<path
			class="fur ol"
			d="M124,176 C162,186 192,158 184,120 C180,100 162,92 152,104 C149,110 152,116 158,118 C166,132 162,154 128,158 Z"
		/>
		<path
			class="ice"
			d="M182,112 C176,98 162,94 154,104 C153,110 155,114 160,116 C168,116 176,120 183,127 Z"
		/>
		<path class="ol thin" fill="none" d="M170,150 l6,2 M176,138 l6,0" />
	</g>
	<g id="body">
		<path class="fur ol" d="M72,122 C64,140 62,168 70,183 L130,183 C138,168 136,140 128,122 Z" />
		<path
			class="shade"
			d="M74,170 C78,178 122,178 126,170 C126,177 124,181 122,182 L78,182 C76,181 74,177 74,170 Z"
		/>
		<path class="ol" fill="none" d="M84,130 L90,142 L95,134 L100,146 L105,134 L110,142 L116,130" />
		<ellipse class="shade ol" cx="86" cy="183" rx="13" ry="8" />
		<ellipse class="shade ol" cx="114" cy="183" rx="13" ry="8" />
		<path
			class="ol thin"
			fill="none"
			d="M82,184 L82,188 M90,184 L90,188 M110,184 L110,188 M118,184 L118,188"
		/>
	</g>
	<g id="head">
		<g id="ear-l">
			<path class="fur ol" d="M64,66 L55,20 Q57,13 64,17 L96,46 Z" />
			<path class="pink" d="M67,58 L61,28 L87,48 Z" />
		</g>
		<g id="ear-r">
			<path class="fur ol" d="M136,66 L145,20 Q143,13 136,17 L104,46 Z" />
			<path class="pink" d="M133,58 L139,28 L113,48 Z" />
		</g>
		<path
			class="fur ol"
			d="M60,70 C60,48 80,40 100,40 C120,40 140,48 140,70 C146,78 152,86 150,94 L162,100 L148,104 L158,114 L140,116 C132,128 116,131 100,131 C84,131 68,128 60,116 L42,114 L52,104 L38,100 L50,94 C48,86 54,78 60,70 Z"
		/>
		<path
			class="mask"
			d="M63,70 C63,52 81,43 100,43 C119,43 137,52 137,70 C131,64 121,66 113,74 L100,86 L87,74 C79,66 69,64 63,70 Z"
		/>
		<ellipse class="pink blush" cx="69" cy="109" rx="7" ry="4" />
		<ellipse class="pink blush" cx="131" cy="109" rx="7" ry="4" />
		{#if eyes === 'open'}
			<g id="eyes">
				{#each [80, 120] as cx (cx)}
					<ellipse class="eye" {cx} cy="90" rx="10.5" ry="12.5" />
					<ellipse class="iris" {cx} cy="94" rx="7" ry="7.5" />
					<circle class="glint" cx={cx - 3.5} cy="85.5" r="3.6" />
					<circle class="glint" cx={cx + 3.5} cy="96.5" r="1.7" />
				{/each}
			</g>
		{:else if eyes === 'happy'}
			<g class="eyes-alt">
				<path class="ol lid" fill="none" d="M70,93 Q80,81 90,93" />
				<path class="ol lid" fill="none" d="M110,93 Q120,81 130,93" />
			</g>
		{:else}
			<g class="eyes-alt">
				<path class="ol lid" fill="none" d="M70,91 Q80,98 90,91" />
				<path class="ol lid" fill="none" d="M110,91 Q120,98 130,91" />
			</g>
		{/if}
		<path class="smile" fill="none" d="M82,112 C88,123 112,123 118,112" />
		<path
			class="nose"
			d="M94.5,104 Q100,100.5 105.5,104 Q103.5,109.5 100,110.5 Q96.5,109.5 94.5,104 Z"
		/>
		<path class="ol mouth" fill="none" d="M92,114 Q96,119 100,114 Q104,119 108,114" />
	</g>
	<YukiProps {state} />
</svg>

<style>
	.yuki {
		display: block;
		flex: none;
		overflow: visible;
		filter: var(--yuki-glow);
	}

	.yuki :global(*) {
		transform-box: fill-box;
	}

	.ol {
		stroke: var(--yuki-outline);
		stroke-width: 3;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.thin {
		stroke-width: 2.2;
	}

	.fur {
		fill: var(--yuki-fur);
	}

	.shade {
		fill: var(--yuki-shade);
	}

	.ice {
		fill: var(--yuki-ice);
	}

	.mask {
		fill: var(--yuki-mask);
	}

	.pink {
		fill: var(--yuki-pink);
	}

	.blush {
		opacity: 0.6;
	}

	.eye {
		fill: var(--yuki-eye);
	}

	.iris {
		fill: var(--yuki-iris);
	}

	.glint {
		fill: var(--yuki-white);
	}

	.lid {
		stroke-width: 3.4;
	}

	.smile {
		stroke: var(--yuki-smile);
		stroke-width: 2;
		stroke-linecap: round;
	}

	.nose {
		fill: var(--yuki-nose);
	}

	.mouth {
		stroke-width: 2.4;
	}

	#tail {
		transform-origin: 10% 90%;
	}

	#body,
	#head {
		transform-origin: 50% 100%;
	}

	#eyes {
		transform-origin: 50% 50%;
	}

	#ear-l {
		transform-origin: 80% 90%;
	}

	#ear-r {
		transform-origin: 20% 90%;
	}

	/* Idle: breathing, a blink every ~5 s, tail sway. */
	.s-idle #tail,
	.s-read #tail {
		animation: yuki-sway var(--dur-yuki-sway) ease-in-out infinite;
	}

	.s-idle #body,
	.s-idle #head,
	.s-read #body {
		animation: yuki-breathe var(--dur-yuki-breathe) ease-in-out infinite;
	}

	.s-idle #eyes,
	.s-read #eyes {
		animation: yuki-blink var(--dur-yuki-blink) infinite;
	}

	.s-trot {
		animation: yuki-trot var(--dur-trot) ease-in-out infinite;
	}

	.s-hop {
		animation: yuki-hop var(--dur-yuki-hop) var(--ease-bounce) 1;
	}

	.s-sparkle {
		animation: yuki-hop var(--dur-yuki-sparkle) var(--ease-bounce) 1;
	}

	.s-celebrate {
		animation: yuki-hop var(--dur-yuki-celebrate) var(--ease-bounce) 3;
	}

	.s-oops #ear-l {
		animation: yuki-droop-l var(--dur-yuki-oops) ease-in-out 1;
	}

	.s-oops #ear-r {
		animation: yuki-droop-r var(--dur-yuki-oops) ease-in-out 1;
	}

	.s-oops #head {
		transform-origin: 50% 90%;
		animation: yuki-tilt var(--dur-yuki-oops) ease-in-out 1;
	}

	.s-think #head {
		transform-origin: 50% 90%;
		animation: yuki-think var(--dur-yuki-think) ease-in-out infinite;
	}

	.s-think #ear-r {
		animation: yuki-twitch var(--dur-yuki-think) ease-in-out infinite;
	}

	.s-sleepy #body,
	.s-sleepy #head {
		animation: yuki-breathe var(--dur-yuki-sleepy) ease-in-out infinite;
	}

	.s-worried-kind #ear-l {
		transform: rotate(-14deg);
	}

	.s-worried-kind #ear-r {
		transform: rotate(14deg);
	}

	.s-sniff #head {
		transform-origin: 50% 90%;
		transform: rotate(10deg) translateY(6px);
	}

	.s-sniff #tail {
		animation: yuki-sway var(--dur-yuki-wag) ease-in-out infinite;
	}

	.still,
	.still :global(*) {
		animation-iteration-count: 1;
	}

	.still.s-idle :global(*) {
		animation: none;
	}
</style>
