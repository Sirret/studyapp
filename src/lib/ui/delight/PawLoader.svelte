<!--
	Paw loader (DESIGN §11.2): for any wait over 300 ms, three paw prints appear in turn and loop,
	in place of a spinner. Screen readers hear the label.
-->
<script lang="ts">
	import Paw from '../motifs/Paw.svelte';

	let { label = 'Loading' }: { label?: string } = $props();
</script>

<span class="loader" role="status" aria-label={label}>
	{#each [0, 1, 2] as i (i)}
		<span class="print" style:animation-delay="calc(var(--dur-slow) * {i})"><Paw size={20} /></span>
	{/each}
</span>

<style>
	.loader {
		display: inline-flex;
		gap: var(--gap-sm);
		color: var(--primary);
	}

	.print {
		opacity: 0.2;
		animation: appear calc(var(--dur-slow) * 3) var(--ease-out) infinite;
	}

	@keyframes appear {
		0%,
		100% {
			opacity: 0.2;
			transform: translateY(0);
		}

		30% {
			opacity: 1;
			transform: translateY(calc(var(--size-px-2) * -1));
		}
	}
</style>
