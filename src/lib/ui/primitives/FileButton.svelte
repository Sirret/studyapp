<!--
	File button (DESIGN §7 secondary button): a native file input dressed as a paper pill with a
	2 px outline. The visible label is the input's
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
		padding: 0 var(--gap-xl);
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-pill);
		background: var(--surface);
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--type-body-size);
		font-weight: var(--type-button-weight);
		cursor: pointer;
	}

	input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.file:focus-within {
		outline: var(--focus-width) solid var(--accent);
		outline-offset: var(--focus-offset);
	}
</style>
