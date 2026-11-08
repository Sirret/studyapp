<!--
	Text area (DESIGN §6 Import): a large paste area styled as notebook paper, with faint ruled lines
	that follow the text. The label names it for screen readers and tests.
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
		color: var(--text-muted);
		font-size: var(--type-small-size);
		font-weight: var(--type-small-weight);
	}

	textarea {
		--rule: var(--type-body-leading);

		width: 100%;
		min-height: calc(var(--rule) * 10);
		padding: var(--gap-sm) var(--gap-md);
		border: var(--stroke) solid transparent;
		border-radius: var(--r-md);
		background-color: var(--surface);
		background-image: linear-gradient(
			transparent calc(var(--rule) - var(--hairline)),
			var(--border) 0
		);
		background-size: 100% var(--rule);
		background-attachment: local;
		background-position-y: var(--gap-sm);
		color: var(--text);
		font-size: var(--type-small-size);
		line-height: var(--rule);
		resize: vertical;
		box-shadow: var(--shadow-1);
	}

	textarea:focus {
		border-color: var(--primary);
		outline: none;
	}
</style>
