<!--
	Option button (DESIGN §5, §12): full width, min 56 px, a letter bubble, and states. Correct pops
	and draws its ✓; wrong shakes and shows ✕ — always icon plus colour, never colour alone.
	`multi` makes it a checkbox-like toggle for select-all-that-apply.
-->
<script module lang="ts">
	export type OptionState = 'default' | 'selected' | 'correct' | 'wrong' | 'revealed';
</script>

<script lang="ts">
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
	<span class="letter" aria-hidden="true">{letter}</span>
	<span class="text">{text}</span>
	{#if state === 'correct' || state === 'revealed'}
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
		--option-border: var(--border);

		display: flex;
		align-items: center;
		gap: var(--gap-md);
		width: 100%;
		min-height: var(--option-min-height);
		padding: var(--gap-sm) var(--gap-md);
		border: var(--stroke) solid var(--option-border);
		border-radius: var(--r-md);
		background: var(--option-bg);
		color: var(--text);
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

	.letter {
		display: grid;
		flex: none;
		place-items: center;
		width: var(--size-px-28);
		height: var(--size-px-28);
		border-radius: var(--r-pill);
		background: var(--primary-soft);
		color: var(--primary);
		font-size: var(--type-small-size);
		font-weight: var(--type-strong-weight);
	}

	.text {
		flex: 1;
		overflow-wrap: anywhere;
	}

	.selected {
		--option-bg: var(--primary-soft);
		--option-border: var(--primary);
	}

	.correct {
		--option-bg: var(--success-soft);
		--option-border: var(--success);

		animation: pop var(--dur-pop) var(--ease-bounce);
	}

	.wrong {
		--option-bg: var(--error-soft);
		--option-border: var(--error);

		animation: shake var(--dur-shake) var(--ease-out);
	}

	.revealed {
		--option-border: var(--success);
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
		stroke: var(--success);
		stroke-dasharray: 24;
		animation: draw var(--dur-check-draw) var(--ease-out) both;
	}

	.cross {
		stroke: var(--error);
	}

	@keyframes pop {
		50% {
			transform: scale(1.04);
		}
	}

	@keyframes shake {
		25% {
			transform: translateX(-6px);
		}

		75% {
			transform: translateX(6px);
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
