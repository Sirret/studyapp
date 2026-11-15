<!--
	One numbered step of the import screen (BUILD_PLAN §10 row 8.5, "numbered steps"), on the cozy
	look (DESIGN §7, mockup "Import · questions"): an IM Fell SC section heading with a Courier
	"Step 1" label, straight on the paper, so the screen reads top to bottom as 1, 2, 3.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import SectionHeading from '../components/SectionHeading.svelte';
	import Stack from '../layout/Stack.svelte';

	let { step, title, children }: { step: number; title: string; children: Snippet } = $props();
</script>

<section aria-label={title}>
	<Stack gap="md">
		<SectionHeading {title}>
			{#snippet action()}<span class="step">Step {step}</span>{/snippet}
		</SectionHeading>
		{@render children()}
	</Stack>
</section>

<style>
	.step {
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking);
		text-transform: uppercase;
		white-space: nowrap;
	}
</style>
