<!--
	Paw checkbox (DESIGN §11.2): a real checkbox whose box fills `--primary` and shows a white paw
	when ticked (a plain check when Yuki is off). Used by explain-it and blurt checklists.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Paw from '../motifs/Paw.svelte';

	let {
		checked = $bindable(false),
		disabled = false,
		children
	}: { checked?: boolean; disabled?: boolean; children: Snippet } = $props();
</script>

<label class="checkbox" class:disabled>
	<input type="checkbox" bind:checked {disabled} />
	<span class="box" aria-hidden="true">
		<span class="paw"><Paw size={16} /></span>
		<svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
			<path d="M5 12.5l4.5 4.5L19 7.5" />
		</svg>
	</span>
	<span class="text">{@render children()}</span>
</label>

<style>
	.checkbox {
		--checkbox-size: var(--size-px-24);
		--checkbox-on: var(--primary);

		display: flex;
		align-items: center;
		gap: var(--gap-md);
		min-height: var(--touch-min);
		cursor: pointer;
	}

	.disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.box {
		position: relative;
		display: grid;
		flex: none;
		place-items: center;
		width: var(--checkbox-size);
		height: var(--checkbox-size);
		border: var(--stroke) solid var(--text-muted);
		border-radius: var(--size-px-6);
		color: var(--on-primary);
		transition: background-color var(--dur-toggle) var(--ease-out);
	}

	.paw,
	.tick {
		position: absolute;
		opacity: 0;
		transform: scale(0.6);
		transition:
			opacity var(--dur-toggle) var(--ease-out),
			transform var(--dur-toggle) var(--ease-bounce);
	}

	.tick {
		width: var(--size-px-20);
		height: var(--size-px-20);
		display: none;
	}

	input:checked + .box {
		border-color: var(--checkbox-on);
		background: var(--checkbox-on);
	}

	input:checked + .box .paw,
	input:checked + .box .tick {
		opacity: 1;
		transform: scale(1);
	}

	:global([data-companion='off']) .paw {
		display: none;
	}

	:global([data-companion='off']) .tick {
		display: block;
	}

	input:focus-visible + .box {
		outline: var(--focus-width) solid var(--focus);
		outline-offset: var(--focus-offset);
	}

	.text {
		flex: 1;
	}
</style>
