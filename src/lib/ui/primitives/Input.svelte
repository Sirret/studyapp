<!--
	Text input (DESIGN §7): paper with a 2 px outline, radius 12, 52 px, Literata 18; focus draws a
	3 px accent ring. A first-letter hint shows the revealed letters faded and underlined before
	the text. The label is required for screen readers; set
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
		--input-bg: var(--surface);

		/* Shrink inside grids and rows instead of pushing them wider (SESSION_NOTES B, 1024 px). */
		min-width: 0;

		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--gap-xs);
	}

	label {
		color: var(--text-soft);
		font-size: var(--type-small-size);
		font-weight: var(--type-small-weight);
	}

	.box {
		display: flex;
		align-items: center;
		gap: var(--gap-2xs);
		min-height: var(--input-height);
		padding: 0 var(--gap-md);
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-input);
		background: var(--input-bg);
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--type-answer-size);
	}

	.box:focus-within {
		outline: var(--focus-width) solid var(--accent);
		outline-offset: var(--focus-offset);
	}

	.lg .box {
		min-height: var(--option-min-height);
		font-weight: var(--type-answer-weight);
	}

	.hint {
		color: var(--text-soft);
		text-decoration: underline;
		text-decoration-color: var(--keyterm);
		text-decoration-thickness: var(--stroke);
		text-underline-offset: var(--size-px-4);
	}

	input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		outline: none;
	}
</style>
