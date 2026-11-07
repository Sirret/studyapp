<!--
	Toggle (DESIGN §5, §12): a 52 × 32 switch, `--primary` when on, whose knob shows a tiny paw
	when on (§11.2; hidden when Yuki is off). A real checkbox with role="switch" underneath.
-->
<script lang="ts">
	import Paw from '../motifs/Paw.svelte';

	let {
		label,
		checked = $bindable(false),
		disabled = false
	}: { label: string; checked?: boolean; disabled?: boolean } = $props();
</script>

<label class="toggle" class:disabled>
	<span class="text">{label}</span>
	<input type="checkbox" role="switch" bind:checked {disabled} />
	<span class="track" aria-hidden="true">
		<span class="knob"><span class="paw"><Paw size={12} /></span></span>
	</span>
</label>

<style>
	.toggle {
		--toggle-on: var(--primary);
		--toggle-off: var(--border);
		--toggle-width: var(--size-px-52);
		--toggle-height: var(--size-px-32);
		--toggle-knob: var(--size-px-24);

		display: flex;
		align-items: center;
		justify-content: space-between;
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

	.track {
		position: relative;
		flex: none;
		width: var(--toggle-width);
		height: var(--toggle-height);
		border-radius: var(--r-pill);
		background: var(--toggle-off);
		transition: background-color var(--dur-toggle) var(--ease-out);
	}

	.knob {
		position: absolute;
		top: var(--size-px-4);
		left: var(--size-px-4);
		display: grid;
		place-items: center;
		width: var(--toggle-knob);
		height: var(--toggle-knob);
		border-radius: var(--r-pill);
		background: var(--surface);
		color: var(--toggle-on);
		transition: transform var(--dur-toggle) var(--ease-out);
	}

	.paw {
		opacity: 0;
		transition: opacity var(--dur-toggle) var(--ease-out);
	}

	input:checked + .track {
		background: var(--toggle-on);
	}

	input:checked + .track .knob {
		transform: translateX(calc(var(--toggle-width) - var(--toggle-knob) - var(--size-px-8)));
	}

	input:checked + .track .paw {
		opacity: 1;
	}

	:global([data-companion='off']) .paw {
		display: none;
	}

	input:focus-visible + .track {
		outline: var(--focus-width) solid var(--focus);
		outline-offset: var(--focus-offset);
	}
</style>
