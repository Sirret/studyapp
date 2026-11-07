<!--
	Bottom sheet (DESIGN §5): secondary choices on a native <dialog> (focus trap, Escape closes),
	extra-large top corners and a drag handle. Closing is always possible.
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
	<span class="handle" aria-hidden="true"></span>
	<h2>{title}</h2>
	{@render children()}
</dialog>

<style>
	.sheet {
		width: 100%;
		max-width: var(--content-max);
		margin: auto auto 0;
		padding: var(--gap-md) var(--screen-gutter) calc(var(--gap-xl) + env(safe-area-inset-bottom));
		border: 0;
		border-radius: var(--r-xl) var(--r-xl) 0 0;
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-2);
	}

	.sheet[open] {
		display: grid;
		gap: var(--gap-md);
		animation: up var(--dur-slow) var(--ease-out);
	}

	.sheet::backdrop {
		background: var(--scrim);
	}

	.handle {
		justify-self: center;
		width: var(--size-px-44);
		height: var(--size-px-4);
		border-radius: var(--r-pill);
		background: var(--border);
	}

	h2 {
		margin: 0;
		font-size: var(--type-heading-size);
		font-weight: var(--type-heading-weight);
	}

	@keyframes up {
		from {
			transform: translateY(100%);
		}
	}
</style>
