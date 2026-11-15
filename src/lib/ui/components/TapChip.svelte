<!--
	Tap chip (DESIGN §7 Chip, for WordBank and DragList): a chip in a bank. Tap to pick it up (it lifts and
	fills ink, like a selected Chip), then tap a slot to place it — the tap alternative to every drag.
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
		--tap-bg: var(--surface);
		--tap-fg: var(--text);
		--tap-border: var(--outline);
		--tap-style: solid;

		display: inline-flex;
		align-items: center;
		gap: var(--gap-xs);
		max-width: 100%;
		min-height: var(--touch-min);
		padding: var(--gap-xs) var(--gap-lg);
		border: var(--border-dashed) var(--tap-style) var(--tap-border);
		border-radius: var(--r-pill);
		background: var(--tap-bg);
		color: var(--tap-fg);
		font-family: var(--font-body);
		font-size: var(--type-body-size);
		line-height: var(--type-caption-leading);
		font-weight: var(--type-body-weight);
		text-align: start;
		overflow-wrap: anywhere;
		cursor: pointer;
		touch-action: manipulation;
		transition: transform var(--dur-fast) var(--ease-out);
	}

	.selected {
		--tap-bg: var(--btn-primary-bg);
		--tap-fg: var(--btn-primary-fg);
		--tap-border: var(--btn-primary-bg);

		transform: translateY(calc(var(--press-travel) * -1));
	}

	.used {
		--tap-border: var(--decor);
		--tap-style: dashed;
		--tap-fg: var(--text-soft);
	}

	.correct {
		--tap-border: var(--correct);

		border-width: var(--stroke);
		font-weight: var(--type-strong-weight);
	}

	.wrong {
		--tap-border: var(--wrong);
		--tap-style: dashed;

		border-width: var(--stroke);
	}

	.correct > :first-child {
		color: var(--correct);
	}

	.wrong > :first-child {
		color: var(--wrong);
	}

	.tap:disabled {
		cursor: default;
	}
</style>
