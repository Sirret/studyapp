<!--
	Paw ring (DESIGN §7, section status): done = a solid correct-coloured disc with a paw, current =
	an outlined ring with an outline paw that pulses gently (`pawin`, §8), not started = a dashed
	decorative ring. The three differ by shape as well as colour; the state is also read out.
-->
<script lang="ts" module>
	export type RingState = 'done' | 'current' | 'todo';
</script>

<script lang="ts">
	import Paw from '../primitives/Paw.svelte';

	let {
		state,
		small = false,
		label
	}: { state: RingState; small?: boolean; label?: string } = $props();

	const WORDS: Record<RingState, string> = {
		done: 'Done',
		current: 'In progress',
		todo: 'Not started'
	};
</script>

<span class="ring {state}" class:small role="img" aria-label={label ?? WORDS[state]}>
	{#if state !== 'todo'}
		<Paw size={small ? 12 : 14} outline={state === 'current'} />
	{/if}
</span>

<style>
	.ring {
		--ring: var(--ring-size);

		display: inline-grid;
		flex: none;
		place-items: center;
		width: var(--ring);
		height: var(--ring);
		border-radius: var(--r-full);
	}

	.small {
		--ring: var(--size-px-22);
	}

	.done {
		background: var(--correct);
		color: var(--surface);
	}

	.current {
		border: var(--border-width) solid var(--outline);
		color: var(--accent);
	}

	.current :global(svg) {
		animation: pawin var(--dur-pawin) var(--ease-linear) infinite alternate;
	}

	.todo {
		border: var(--border-dashed) dashed var(--decor);
	}

	@keyframes pawin {
		from {
			opacity: 0.35;
		}

		to {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.current :global(svg) {
			animation: none;
		}
	}
</style>
