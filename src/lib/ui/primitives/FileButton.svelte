<!--
	File button: a native file input dressed as a secondary button. The visible label is the input's
	label, so it stays accessible and keyboard-operable.
-->
<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = Omit<HTMLInputAttributes, 'type'> & { label: string };

	let { label, ...rest }: Props = $props();
</script>

<label class="file" data-paw>
	<input {...rest} type="file" />
	<span>{label}</span>
</label>

<style>
	.file {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: var(--touch-min);
		padding: 0 var(--gap-lg);
		border-radius: var(--r-md);
		background: var(--primary-soft);
		color: var(--primary);
		font-size: var(--type-small-size);
		font-weight: var(--type-strong-weight);
		box-shadow: inset 0 calc(var(--lip-height) * -1) 0 var(--lip-secondary);
		cursor: pointer;
	}

	input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.file:focus-within {
		outline: var(--focus-width) solid var(--focus);
		outline-offset: var(--focus-offset);
	}
</style>
