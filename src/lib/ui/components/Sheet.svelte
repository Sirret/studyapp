<!--
	Sheet (DESIGN §7): secondary choices on a native <dialog> (focus trap, Escape closes): paper,
	a 2 px outline, radius 14 at the top and a knit band along the top edge. Closing is always possible.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		title,
		children
	}: { open?: boolean; title: string; children: Snippet } = $props();
	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	class="sheet"
	aria-label={title}
	onclose={() => (open = false)}
	onclick={(event) => event.target === dialog && (open = false)}
>
	<span class="knit band" aria-hidden="true"></span>
	<h2>{title}</h2>
	{@render children()}
</dialog>

<style>
	.sheet {
		width: 100%;
		max-width: var(--content-max);
		margin: auto auto 0;
		overflow: hidden;
		padding: 0 var(--screen-gutter) calc(var(--gap-xl) + env(safe-area-inset-bottom));
		border: var(--border-width) solid var(--outline);
		border-bottom: 0;
		border-radius: var(--r-md) var(--r-md) 0 0;
		background: var(--surface);
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--type-body-size);
		line-height: var(--type-body-leading);
	}

	.sheet[open] {
		display: grid;
		gap: var(--gap-md);
		animation: up var(--dur-slow) var(--ease-out);
	}

	.sheet::backdrop {
		background: var(--scrim);
	}

	.band {
		margin: 0 calc(var(--screen-gutter) * -1);
	}

	h2 {
		margin: 0;
		color: var(--text-strong);
		font-family: var(--font-wordmark);
		font-size: var(--type-heading-size);
		line-height: var(--type-heading-leading);
		font-weight: var(--type-heading-weight);
		letter-spacing: var(--type-heading-tracking);
	}

	@keyframes up {
		from {
			transform: translateY(100%);
		}
	}
</style>
