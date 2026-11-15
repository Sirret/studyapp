<!--
	OptionBubble, the "toe-bean" option (DESIGN §7): paper with a 2 px outline, radius 14, min 56 px,
	a round letter bean on the left. Selected = kraft tint plus a thicker outline; correct = pine
	outline plus a paw stamp ✓ (pops); wrong = oxblood dashed outline plus ✕ (shakes); revealed =
	pine outline plus ✓. Always mark plus colour plus screen-reader word, never colour alone.
	`multi` makes it a checkbox-like toggle for select-all-that-apply.
-->
<script module lang="ts">
	export type OptionState = 'default' | 'selected' | 'correct' | 'wrong' | 'revealed';
</script>

<script lang="ts">
	import Paw from '#lib/ui/primitives/Paw.svelte';

	let {
		letter,
		text,
		state = 'default',
		disabled = false,
		multi = false,
		onclick
	}: {
		letter: string;
		text: string;
		state?: OptionState;
		disabled?: boolean;
		multi?: boolean;
		onclick?: () => void;
	} = $props();

	const STATE_LABEL: Record<OptionState, string> = {
		default: '',
		selected: '',
		correct: 'correct',
		wrong: 'wrong',
		revealed: 'the right answer'
	};
</script>

<button
	type="button"
	class="option {state}"
	{disabled}
	aria-pressed={multi ? state === 'selected' : undefined}
	{onclick}
	data-paw
	data-option-state={state}
>
	<span class="bean" aria-hidden="true">{letter}</span>
	<span class="text">{text}</span>
	{#if state === 'correct'}
		<span class="stamp" aria-hidden="true"><Paw size={16} /></span>
	{:else if state === 'revealed'}
		<svg class="mark check" viewBox="0 0 24 24" aria-hidden="true"
			><path d="M5 12.5l4.5 4.5L19 7.5" /></svg
		>
	{:else if state === 'wrong'}
		<svg class="mark cross" viewBox="0 0 24 24" aria-hidden="true"
			><path d="M6 6l12 12M18 6L6 18" /></svg
		>
	{/if}
	{#if STATE_LABEL[state]}<span class="sr-only">({STATE_LABEL[state]})</span>{/if}
</button>

<style>
	.option {
		--option-bg: var(--surface);
		--option-border: var(--outline);
		--option-width: var(--stroke);
		--option-style: solid;
		--bean-bg: var(--surface-tag);
		--bean-fg: var(--text);

		display: flex;
		align-items: center;
		gap: var(--gap-md);
		width: 100%;
		min-height: var(--option-min-height);
		padding: var(--gap-sm) var(--gap-md);
		border: var(--option-width) var(--option-style) var(--option-border);
		border-radius: var(--r-md);
		background: var(--option-bg);
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--type-answer-size);
		line-height: var(--type-answer-leading);
		font-weight: var(--type-answer-weight);
		text-align: start;
		cursor: pointer;
		touch-action: manipulation;
		transition: transform var(--dur-fast) var(--ease-out);
	}

	.option:active:not(:disabled) {
		transform: translateY(var(--press-travel));
	}

	.option:disabled {
		cursor: default;
	}

	.bean {
		display: grid;
		flex: none;
		place-items: center;
		width: var(--bean-size);
		height: var(--bean-size);
		border: var(--border-dashed) solid var(--outline);
		border-radius: var(--r-full);
		background: var(--bean-bg);
		color: var(--bean-fg);
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		font-weight: var(--type-label-weight);
	}

	.text {
		flex: 1;
		overflow-wrap: anywhere;
	}

	.selected {
		--option-bg: var(--surface-tag);
		--option-width: var(--stroke-strong);
	}

	.correct {
		--option-border: var(--correct);
		--option-width: var(--stroke-strong);
		--bean-bg: var(--correct);
		--bean-fg: var(--surface);

		animation: pop var(--dur-pop) var(--ease-bounce);
	}

	.wrong {
		--option-border: var(--wrong);
		--option-style: dashed;

		animation: shake var(--dur-shake) var(--ease-out);
	}

	.revealed {
		--option-border: var(--correct);
	}

	.stamp {
		display: grid;
		flex: none;
		place-items: center;
		width: var(--mark-size);
		height: var(--mark-size);
		border: var(--border-dashed) dashed var(--accent);
		border-radius: var(--r-full);
		background: var(--surface);
		color: var(--accent);
		transform: rotate(var(--stamp-land));
		animation: stamp var(--dur-stamp) var(--ease-out);
	}

	.mark {
		flex: none;
		width: var(--icon-nav);
		height: var(--icon-nav);
		fill: none;
		stroke-width: 3;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.check {
		stroke: var(--correct);
		stroke-dasharray: 24;
		animation: draw var(--dur-check-draw) var(--ease-out) both;
	}

	.cross {
		stroke: var(--wrong);
	}

	@keyframes pop {
		50% {
			transform: scale(1.03);
		}
	}

	/* DESIGN §8 nudge: 0, −6, 6, −3, 0 */
	@keyframes shake {
		25% {
			transform: translateX(calc(var(--shake-distance) * -1));
		}

		50% {
			transform: translateX(var(--shake-distance));
		}

		75% {
			transform: translateX(calc(var(--shake-distance) * -0.5));
		}
	}

	/* DESIGN §8 stamp: scale 1.7 → .9 → 1, rotate −20° → −8°, opacity 0 → 1 */
	@keyframes stamp {
		from {
			opacity: 0;
			transform: scale(var(--stamp-scale-from)) rotate(var(--stamp-from));
		}

		60% {
			opacity: 1;
			transform: scale(var(--stamp-overshoot)) rotate(var(--stamp-land));
		}
	}

	@keyframes draw {
		from {
			stroke-dashoffset: 24;
		}

		to {
			stroke-dashoffset: 0;
		}
	}
</style>
