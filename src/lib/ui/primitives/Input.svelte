<!--
	Text input (DESIGN §5, §12): inset surface, 48 px, a primary border on focus. A first-letter
	hint shows as a faded letter before the text. The label is required for screen readers; set
	`hideLabel` when the prompt already says what to type.
-->
<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = Omit<HTMLInputAttributes, 'value' | 'size'> & {
		label: string;
		hideLabel?: boolean;
		value?: string;
		hint?: string | null;
		size?: 'md' | 'lg';
		ref?: HTMLInputElement | undefined;
	};

	let {
		label,
		hideLabel = false,
		value = $bindable(''),
		hint = null,
		size = 'md',
		ref = $bindable(),
		...rest
	}: Props = $props();
	const id = $props.id();
</script>

<div class="field {size}">
	<label for={id} class:sr-only={hideLabel}>{label}</label>
	<div class="box">
		{#if hint}<span class="hint" aria-hidden="true">{hint}</span>{/if}
		<input
			{...rest}
			{id}
			bind:value
			bind:this={ref}
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
		/>
	</div>
</div>

<style>
	.field {
		--input-bg: var(--surface-alt);
		--input-radius: var(--r-sm);

		display: grid;
		gap: var(--gap-xs);
	}

	label {
		color: var(--text-muted);
		font-size: var(--type-small-size);
		font-weight: var(--type-small-weight);
	}

	.box {
		display: flex;
		align-items: center;
		gap: var(--gap-xs);
		min-height: var(--input-height);
		padding: 0 var(--gap-md);
		border: var(--stroke) solid transparent;
		border-radius: var(--input-radius);
		background: var(--input-bg);
		transition: border-color var(--dur-fast) var(--ease-out);
	}

	.box:focus-within {
		border-color: var(--primary);
	}

	.lg .box {
		min-height: var(--option-min-height);
		font-size: var(--type-answer-size);
		font-weight: var(--type-answer-weight);
	}

	.hint {
		color: var(--text-muted);
		font-weight: var(--type-strong-weight);
		opacity: 0.6;
	}

	input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		outline: none;
	}
</style>
