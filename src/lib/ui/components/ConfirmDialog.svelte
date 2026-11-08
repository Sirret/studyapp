<!--
	Confirm dialog: asks before something that can't easily be undone (trashing a course). A native
	modal <dialog> (focus stays inside, Escape cancels), centred, with the safe choice first.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from '../primitives/Button.svelte';

	let {
		open = $bindable(false),
		title,
		confirmLabel,
		busy = false,
		onconfirm,
		children
	}: {
		open?: boolean;
		title: string;
		confirmLabel: string;
		busy?: boolean;
		onconfirm: () => void;
		children: Snippet;
	} = $props();
	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	class="confirm"
	aria-labelledby="confirm-title"
	onclose={() => (open = false)}
	data-confirm-dialog
>
	<h2 id="confirm-title">{title}</h2>
	<div class="body">{@render children()}</div>
	<div class="actions">
		<Button variant="secondary" full onclick={() => (open = false)}>Cancel</Button>
		<Button full loading={busy} onclick={onconfirm} data-confirm>{confirmLabel}</Button>
	</div>
</dialog>

<style>
	.confirm {
		width: calc(100% - var(--space-32));
		max-width: calc(var(--content-max) * 0.75);
		padding: var(--gap-xl);
		border: 0;
		border-radius: var(--r-xl);
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-2);
	}

	.confirm[open] {
		display: grid;
		gap: var(--gap-md);
		animation: pop var(--dur-base) var(--ease-out);
	}

	.confirm::backdrop {
		background: var(--scrim);
	}

	h2 {
		margin: 0;
		font-size: var(--type-heading-size);
		line-height: var(--type-heading-leading);
		font-weight: var(--type-heading-weight);
	}

	.body {
		color: var(--text-muted);
	}

	.actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--gap-sm);
	}

	@keyframes pop {
		from {
			opacity: 0;
			transform: scale(0.96);
		}
	}
</style>
