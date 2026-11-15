<!--
	Flashcard (DESIGN §7, §8 card-flip): a soft tab-shaped card on a small stacked deck (two cards
	peeking behind). The front shows the term in Literata 26; tapping the card flips it in 3D to
	the answer. "Hint" is a link button that reveals the answer's first three words. The hidden
	face is inert. Under reduced motion the flip is an instant change. The fly-away after "Know it"
	or "Still learning" belongs to the session (§8 card-fly), not this component.
-->
<script lang="ts">
	import Button from '../primitives/Button.svelte';

	let {
		term,
		answer,
		flipped = $bindable(false)
	}: { term: string; answer: string; flipped?: boolean } = $props();

	const HINT_WORDS = 3;
	let hinted = $state(false);
	const hint = $derived(`${answer.split(/\s+/).slice(0, HINT_WORDS).join(' ')}…`);
</script>

<div class="flashcard">
	<div class="deck">
		<button
			type="button"
			class="card"
			class:flipped
			aria-label={flipped ? `Answer: ${answer}. Show the term` : `${term}. Show the answer`}
			onclick={() => (flipped = !flipped)}
		>
			<span class="inner">
				<span class="face front" inert={flipped}>
					<span class="side">Term</span>
					<span class="term">{term}</span>
				</span>
				<span class="face back" inert={!flipped}>
					<span class="side">Answer</span>
					<span class="answer">{answer}</span>
				</span>
			</span>
		</button>
	</div>
	{#if !flipped}
		<div class="hint">
			{#if hinted}
				<p class="hint-text">{hint}</p>
			{:else}
				<Button variant="ghost" onclick={() => (hinted = true)}>Hint</Button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.flashcard {
		display: grid;
		gap: var(--gap-sm);
		justify-items: center;
	}

	.deck {
		position: relative;
		isolation: isolate;
		width: 100%;
		padding-bottom: calc(var(--deck-offset) * 2);
	}

	/* Two cards peeking out below the top one: flat, printed, no blur. */
	.deck::before,
	.deck::after {
		content: '';
		position: absolute;
		inset: 0 0 calc(var(--deck-offset) * 2);
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-tab);
		background: var(--surface);
	}

	.deck::before {
		transform: translateY(calc(var(--deck-offset) * 2)) scale(0.94);
	}

	.deck::after {
		transform: translateY(var(--deck-offset)) scale(0.97);
	}

	.card {
		position: relative;
		z-index: var(--z-raised);
		display: block;
		width: 100%;
		padding: 0;
		border: none;
		background: none;
		color: var(--text);
		font: inherit;
		cursor: pointer;
		perspective: calc(var(--content-max) * 2);
	}

	.inner {
		display: grid;
		transform-style: preserve-3d;
		transition: transform var(--dur-card-flip) var(--ease-out);
	}

	.flipped .inner {
		transform: rotateY(180deg);
	}

	.face {
		display: grid;
		grid-area: 1 / 1;
		place-content: center;
		gap: var(--gap-sm);
		min-height: calc(var(--control-height) * 4);
		padding: var(--gap-xl) var(--gap-lg);
		border: var(--border-width) solid var(--outline);
		border-radius: var(--r-tab);
		background: var(--surface);
		box-shadow: var(--shadow-raised);
		text-align: center;
		backface-visibility: hidden;
	}

	.back {
		transform: rotateY(180deg);
	}

	.side {
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking-wide);
		text-transform: uppercase;
	}

	.term {
		font-size: var(--type-term-size);
		line-height: var(--type-title-leading);
		font-weight: var(--type-button-weight);
	}

	.answer {
		font-size: var(--type-answer-size);
		line-height: var(--type-answer-leading);
	}

	.hint {
		display: grid;
		justify-items: center;
		min-height: var(--touch-min);
	}

	.hint-text {
		margin: 0;
		color: var(--text-soft);
		font-size: var(--type-body-size);
		font-style: italic;
		line-height: var(--touch-min);
	}
</style>
