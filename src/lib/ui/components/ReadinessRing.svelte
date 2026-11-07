<!--
	Readiness ring (DESIGN §5): a ring in the course colour showing the share exam-ready (or secure
	in long-term), the number in the centre and a label below. Read as "62% exam-ready".
-->
<script lang="ts">
	import type { CourseColor } from '#lib/design/tokens.ts';

	let {
		percent,
		color = 'lavender',
		label = 'exam-ready',
		size = 72
	}: { percent: number; color?: CourseColor; label?: string; size?: number } = $props();

	const RADIUS = 30;
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
	const clamped = $derived(Math.max(0, Math.min(100, Math.round(percent))));
</script>

<figure class="ring" role="img" aria-label="{clamped}% {label}">
	<svg viewBox="0 0 72 72" width={size} height={size} aria-hidden="true">
		<circle class="track" cx="36" cy="36" r={RADIUS} />
		<circle
			class="value"
			cx="36"
			cy="36"
			r={RADIUS}
			style:stroke="var(--course-{color})"
			stroke-dasharray={CIRCUMFERENCE}
			stroke-dashoffset={CIRCUMFERENCE * (1 - clamped / 100)}
		/>
		<text x="36" y="41" text-anchor="middle" class="number" font-size="15">{clamped}%</text>
	</svg>
	<figcaption>{label}</figcaption>
</figure>

<style>
	.ring {
		display: grid;
		justify-items: center;
		gap: var(--gap-xs);
		margin: 0;
	}

	circle {
		fill: none;
		stroke-width: 8;
	}

	.track {
		stroke: var(--primary-soft);
	}

	.value {
		stroke-linecap: round;
		transform: rotate(-90deg);
		transform-origin: center;
		transition: stroke-dashoffset var(--dur-slow) var(--ease-out);
	}

	.number {
		fill: var(--text);
		font-weight: var(--type-display-weight);
		font-variant-numeric: tabular-nums;
	}

	figcaption {
		color: var(--text-muted);
		font-size: var(--type-caption-size);
		font-weight: var(--type-caption-weight);
	}
</style>
