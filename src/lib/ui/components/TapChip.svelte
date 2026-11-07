<!--
	Tap chip (DESIGN §5 WordBank, DragList): a chip in a bank. Tap to pick it up (it lifts and
	fills `--primary-soft`), then tap a slot to place it — the tap alternative to every drag.
	After checking, chips show correct (✓) or wrong (✕) with icon and colour.
-->
<script module lang="ts">
	export type ChipState = 'default' | 'selected' | 'used' | 'correct' | 'wrong';
</script>

<script lang="ts">
	let {
		text,
		state = 'default',
		disabled = false,
		onclick
	}: { text: string; state?: ChipState; disabled?: boolean; onclick?: () => void } = $props();
</script>

<button
	type="button"
	class="tap {state}"
	{disabled}
	aria-pressed={state === 'selected'}
	{onclick}
	data-paw
	data-chip-state={state}
>
	{#if state === 'correct'}<span aria-hidden="true">✓</span><span class="sr-only">correct:</span
		>{/if}
	{#if state === 'wrong'}<span aria-hidden="true">✕</span><span class="sr-only">wrong:</span>{/if}
	<span>{text}</span>
</button>

<style>
	.tap {
		--tap-bg: var(--surface-alt);
		--tap-border: transparent;

		display: inline-flex;
		align-items: center;
		gap: var(--gap-xs);
		max-width: 100%;
		min-height: var(--touch-min);
		padding: var(--gap-xs) var(--gap-md);
		border: var(--stroke) solid var(--tap-border);
		border-radius: var(--r-sm);
		background: var(--tap-bg);
		color: var(--text);
		font-size: var(--type-body-size);
		line-height: var(--type-body-leading);
		font-weight: var(--type-strong-weight);
		text-align: start;
		overflow-wrap: anywhere;
		cursor: pointer;
		touch-action: manipulation;
		transition: transform var(--dur-fast) var(--ease-out);
	}

	.selected {
		--tap-bg: var(--primary-soft);
		--tap-border: var(--primary);

		transform: translateY(calc(var(--press-travel) * -1));
	}

	.used {
		opacity: 0.4;
	}

	.correct {
		--tap-bg: var(--success-soft);
		--tap-border: var(--success);
	}

	.wrong {
		--tap-bg: var(--error-soft);
		--tap-border: var(--error);
	}

	.tap:disabled {
		cursor: default;
	}
</style>
