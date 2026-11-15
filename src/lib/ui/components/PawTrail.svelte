<!--
	Paw trail (DESIGN §7, progress): a row of small paws — done = solid ink, current = accent with a
	gentle opacity pulse (`pawin`, §8), upcoming = a dashed decorative outline — plus a Courier meta
	line such as "§2 of 3 · 3 min". It replaces progress bars. One role="img" carries the label
	(§11), e.g. "Section 2 of 3". `current` is 0-based; `current >= total` means all done.
-->
<script lang="ts">
	import Paw from '../primitives/Paw.svelte';

	let {
		total,
		current,
		label,
		meta
	}: { total: number; current: number; label: string; meta?: string } = $props();

	type Step = 'done' | 'current' | 'upcoming';

	const steps = $derived(
		Array.from({ length: total }, (_unused, i): Step =>
			i < current ? 'done' : i === current ? 'current' : 'upcoming'
		)
	);
</script>

<div class="trail">
	<span class="paws" role="img" aria-label={label}>
		{#each steps as step, i (i)}
			<span class="paw {step}"><Paw size={16} dashed={step === 'upcoming'} /></span>
		{/each}
	</span>
	{#if meta}<span class="meta" aria-hidden="true">{meta}</span>{/if}
</div>

<style>
	.trail {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--gap-xs) var(--gap-md);
	}

	.paws {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--gap-xs);
	}

	.done {
		color: var(--text);
	}

	.current {
		color: var(--accent);
		animation: pawin var(--dur-pawin) var(--ease-linear) infinite alternate;
	}

	.upcoming {
		color: var(--decor);
	}

	.meta {
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking);
		text-transform: uppercase;
	}

	@keyframes pawin {
		from {
			opacity: 0.35;
		}

		to {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.current {
			animation: none;
		}
	}
</style>
