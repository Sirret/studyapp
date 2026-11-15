<!--
	Text area (DESIGN §7 Input, for the import paste): raised paper with a 2 px outline and faint
	ruled lines that follow the text; focus draws the 3 px accent ring. The label names it for screen readers and tests.
-->
<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	type Props = Omit<HTMLTextareaAttributes, 'value'> & {
		label: string;
		value?: string;
		ref?: HTMLTextAreaElement | undefined;
	};

	let { label, value = $bindable(''), ref = $bindable(), ...rest }: Props = $props();
	const id = $props.id();
</script>

<div class="field">
	<label for={id}>{label}</label>
	<textarea {...rest} {id} bind:value bind:this={ref} spellcheck="false"></textarea>
</div>

<style>
	.field {
		display: grid;
		gap: var(--gap-xs);
	}

	label {
		color: var(--text-soft);
		font-size: var(--type-small-size);
		font-weight: var(--type-small-weight);
	}

	textarea {
		--rule: var(--type-body-leading);

		width: 100%;
		min-height: calc(var(--rule) * 10);
		padding: var(--gap-sm) var(--gap-md);
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-input);
		background-color: var(--surface);
		background-image: linear-gradient(
			transparent calc(var(--rule) - var(--hairline)),
			var(--line) 0
		);
		background-size: 100% var(--rule);
		background-attachment: local;
		background-position-y: var(--gap-sm);
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--type-small-size);
		line-height: var(--rule);
		resize: vertical;
	}

	textarea:focus-visible {
		outline: var(--focus-width) solid var(--accent);
		outline-offset: var(--focus-offset);
	}
</style>
