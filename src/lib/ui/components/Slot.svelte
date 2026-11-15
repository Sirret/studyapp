<!--
	Slot (DESIGN §7, DropZone): a dashed place to put a chip. Takes the kraft tint while
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
		--slot-border: var(--decor);
		--slot-style: dashed;

		display: grid;
		gap: var(--gap-xs);
		width: 100%;
		min-height: var(--option-min-height);
		padding: var(--gap-sm) var(--gap-md);
		border: var(--stroke) var(--slot-style) var(--slot-border);
		border-radius: var(--r-md);
		background: var(--slot-bg);
		color: var(--text);
		font-family: var(--font-body);
		text-align: start;
		cursor: pointer;
		touch-action: manipulation;
	}

	.label {
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size);
		line-height: var(--type-caption-leading);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking);
		text-transform: uppercase;
		overflow-wrap: anywhere;
	}

	.value {
		font-size: var(--type-answer-size);
		font-weight: var(--type-answer-weight);
		overflow-wrap: anywhere;
	}

	.empty .value {
		color: var(--text-soft);
		font-weight: var(--type-body-weight);
	}

	.ready {
		--slot-bg: var(--surface-tag);
		--slot-border: var(--outline);
	}

	.filled {
		--slot-bg: var(--surface);
		--slot-border: var(--outline);
		--slot-style: solid;
	}

	.correct {
		--slot-bg: var(--surface);
		--slot-border: var(--correct);
		--slot-style: solid;
	}

	.wrong {
		--slot-bg: var(--surface);
		--slot-border: var(--wrong);
	}

	.correct .value > :first-child {
		color: var(--correct);
	}

	.wrong .value > :first-child {
		color: var(--wrong);
	}

	.slot:disabled {
		cursor: default;
	}
</style>
