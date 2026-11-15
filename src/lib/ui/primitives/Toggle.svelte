<!--
	Toggle (DESIGN §7): a 52 × 32 outlined track; on fills ink (`--btn-primary-bg`) and the knob
	shows a small accent paw (hidden when Yuki is off). A real checkbox with role="switch" underneath.
-->
<script lang="ts">
	import Paw from './Paw.svelte';

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
		<span class="knob"><span class="paw"><Paw size={14} /></span></span>
	</span>
</label>

<style>
	.toggle {
		--toggle-on: var(--btn-primary-bg);
		--toggle-width: var(--size-px-52);
		--toggle-height: var(--size-px-32);
		--toggle-knob: var(--size-px-22);
		--toggle-inset: var(--size-px-3);

		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap-md);
		min-height: var(--touch-min);
		color: var(--text);
		font-size: var(--type-body-size);
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
		box-sizing: border-box;
		width: var(--toggle-width);
		height: var(--toggle-height);
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-pill);
		background: var(--surface);
		transition: background-color var(--dur-toggle) var(--ease-out);
	}

	.knob {
		position: absolute;
		top: var(--toggle-inset);
		left: var(--toggle-inset);
		display: grid;
		place-items: center;
		width: var(--toggle-knob);
		height: var(--toggle-knob);
		border-radius: var(--r-full);
		background: var(--text-soft);
		color: var(--accent);
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
		background: var(--surface);
		transform: translateX(
			calc(
				var(--toggle-width) - var(--toggle-knob) - var(--toggle-inset) * 2 - var(--border-width) * 2
			)
		);
	}

	input:checked + .track .paw {
		opacity: 1;
	}

	:global([data-companion='off']) .paw {
		display: none;
	}

	input:focus-visible + .track {
		outline: var(--focus-width) solid var(--accent);
		outline-offset: var(--focus-offset);
	}
</style>
