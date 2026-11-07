<!--
	Slot (DESIGN §5 DropZone): a labelled place to put a chip. Highlights in `--primary-soft` while
	a chip is picked up; tap it to place the chip, tap a filled slot to take the chip back.
-->
<script module lang="ts">
	export type SlotState = 'empty' | 'ready' | 'filled' | 'correct' | 'wrong';
</script>

<script lang="ts">
	let {
		label,
		value,
		state = 'empty',
		disabled = false,
		onclick
	}: {
		label?: string;
		value?: string;
		state?: SlotState;
		disabled?: boolean;
		onclick?: () => void;
	} = $props();
</script>

<button
	type="button"
	class="slot {state}"
	{disabled}
	{onclick}
	aria-label={`${label ? `${label}: ` : ''}${value ?? 'empty, tap to place'}`}
	data-slot-state={state}
>
	{#if label}<span class="label">{label}</span>{/if}
	<span class="value">
		{#if state === 'correct'}<span aria-hidden="true">✓ </span>{/if}
		{#if state === 'wrong'}<span aria-hidden="true">✕ </span>{/if}
		{value ?? '—'}
	</span>
</button>

<style>
	.slot {
		--slot-bg: transparent;
		--slot-border: var(--border);

		display: grid;
		gap: var(--gap-xs);
		width: 100%;
		min-height: var(--option-min-height);
		padding: var(--gap-sm) var(--gap-md);
		border: var(--stroke) dashed var(--slot-border);
		border-radius: var(--r-md);
		background: var(--slot-bg);
		color: var(--text);
		text-align: start;
		cursor: pointer;
		touch-action: manipulation;
	}

	.label {
		color: var(--text-muted);
		font-size: var(--type-small-size);
		line-height: var(--type-small-leading);
		font-weight: var(--type-small-weight);
		overflow-wrap: anywhere;
	}

	.value {
		font-weight: var(--type-strong-weight);
		overflow-wrap: anywhere;
	}

	.empty .value {
		color: var(--text-muted);
	}

	.ready {
		--slot-bg: var(--primary-soft);
		--slot-border: var(--primary);
	}

	.filled {
		--slot-border: var(--primary);

		border-style: solid;
	}

	.correct {
		--slot-bg: var(--success-soft);
		--slot-border: var(--success);

		border-style: solid;
	}

	.wrong {
		--slot-bg: var(--error-soft);
		--slot-border: var(--error);

		border-style: solid;
	}

	.slot:disabled {
		cursor: default;
	}
</style>
