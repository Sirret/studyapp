<!--
	Readiness meter (DESIGN §7): a paw trail of ten paws, filled for the exam-ready share, plus a
	Courier "68% exam-ready". Per-topic rows reuse PawRing. Read as one image: "68% exam-ready".
-->
<script lang="ts">
	import Paw from '../primitives/Paw.svelte';

	let { percent, label = 'exam-ready' }: { percent: number; label?: string } = $props();

	const PAWS = 10;
	const clamped = $derived(Math.max(0, Math.min(100, Math.round(percent))));
	const filled = $derived(Math.round((clamped / 100) * PAWS));
</script>

<div class="meter" role="img" aria-label="{clamped}% {label}">
	<span class="paws" aria-hidden="true">
		{#each Array.from({ length: PAWS }, (_unused, i) => i) as i (i)}
			<span class="paw" class:filled={i < filled}><Paw size={16} dashed={i >= filled} /></span>
		{/each}
	</span>
	<span class="value" aria-hidden="true">{clamped}% {label}</span>
</div>

<style>
	.meter {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--gap-xs) var(--gap-md);
	}

	.paws {
		display: inline-flex;
		gap: var(--gap-xs);
	}

	.paw {
		color: var(--decor);
	}

	.filled {
		color: var(--text);
	}

	.value {
		color: var(--text);
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking);
		text-transform: uppercase;
		font-variant-numeric: tabular-nums;
	}
</style>
