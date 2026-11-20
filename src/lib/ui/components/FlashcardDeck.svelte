<!--
	Flashcard deck (Practice; SESSION_NOTES §C; DESIGN §8 card-fly, §10 Flashcards; mockup
	07-flashcards-lamp): one pass through the cards. Tap the card to flip; "Still learning" sends it
	left, "Know it" sends it right (CardFly), and the next card rises. Keys: Space flips, ← Still
	learning, → Know it, H hint. Tallies sit above the card on phones and in a deck panel with the
	key hints from 1024 px. Nothing is logged (Decisions log "Phase 8.6 Q4"); `ondone` gets the
	sorted card keys when the pass ends, and `done` renders in the deck's place.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import CardFly from '../delight/CardFly.svelte';
	import {
		deckDone,
		deckKey,
		rateCard,
		startDeck,
		topCard,
		type DeckState,
		type DeckVerdict
	} from '../flashcards/deck-state.ts';
	import Button from '../primitives/Button.svelte';
	import Flashcard from './Flashcard.svelte';

	type DeckCardView = { key: string; term: string; answer: string };
	type DeckResult = { learning: readonly string[]; known: readonly string[] };

	let {
		cards,
		keyboard = true,
		ondone,
		done
	}: {
		cards: DeckCardView[];
		/** Listen for the deck keys on the window (off where several decks share a page). */
		keyboard?: boolean;
		ondone?: (result: DeckResult) => void;
		done?: Snippet<[DeckResult]>;
	} = $props();

	// The deck is fixed for one pass; a new pass remounts the component.
	// svelte-ignore state_referenced_locally
	let deck: DeckState = $state(startDeck(cards.map((c) => c.key)));
	let flipped = $state(false);
	let hinted = $state(false);
	let fly: 'left' | 'right' | null = $state(null);
	let pending: DeckVerdict | null = null;

	const byKey = $derived(new Map(cards.map((c) => [c.key, c])));
	const top = $derived.by(() => {
		const key = topCard(deck);
		return key === null ? null : (byKey.get(key) ?? null);
	});

	function rate(verdict: DeckVerdict): void {
		if (top === null || fly !== null) return;
		pending = verdict;
		fly = verdict === 'learning' ? 'left' : 'right';
	}

	function flown(): void {
		if (pending === null) return;
		deck = rateCard(deck, pending);
		pending = null;
		fly = null;
		flipped = false;
		hinted = false;
		if (deckDone(deck)) ondone?.({ learning: deck.learning, known: deck.known });
	}

	function onkeydown(event: KeyboardEvent): void {
		if (!keyboard || event.altKey || event.ctrlKey || event.metaKey || top === null) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
		const action = deckKey(event.key);
		if (action === null) return;
		event.preventDefault();
		if (action === 'flip') flipped = !flipped;
		else if (action === 'hint') hinted = true;
		else rate(action);
	}
</script>

<svelte:window {onkeydown} />

{#if top === null}
	{@render done?.({ learning: deck.learning, known: deck.known })}
{:else}
	<div class="deck" data-flashcard-deck>
		<div class="panel">
			<p class="count">Card {deck.index + 1} of {deck.order.length}</p>
			<div class="tallies">
				<span class="tally learning" data-tally="learning">
					<span aria-hidden="true">‹</span> Still learning {deck.learning.length}
				</span>
				<span class="tally known" data-tally="known">
					Know it {deck.known.length} <span aria-hidden="true">›</span>
				</span>
			</div>
			<ul class="keys" aria-label="Keyboard">
				<li><kbd>Space</kbd> flip</li>
				<li><kbd>←</kbd> still learning</li>
				<li><kbd>→</kbd> know it</li>
				<li><kbd>H</kbd> hint</li>
			</ul>
		</div>
		<div class="stage">
			<CardFly key={deck.index} {fly} onflown={flown}>
				<Flashcard term={top.term} answer={top.answer} bind:flipped bind:hinted />
			</CardFly>
			<div class="actions">
				<Button variant="secondary" full onclick={() => rate('learning')} data-deck-learning>
					Still learning
				</Button>
				<Button full onclick={() => rate('know')} data-deck-know>Know it</Button>
			</div>
		</div>
	</div>
{/if}

<style>
	.deck {
		display: grid;
		gap: var(--gap-lg);
	}

	.panel {
		display: grid;
		gap: var(--gap-sm);
	}

	.count {
		margin: 0;
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		letter-spacing: var(--type-label-tracking);
	}

	.tallies {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--gap-sm);
	}

	.tally {
		padding: var(--gap-xs) var(--gap-sm);
		border: var(--hairline) dashed var(--accent);
		border-radius: var(--r-xs);
		color: var(--accent);
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking);
		text-transform: uppercase;
	}

	.known {
		border-style: solid;
		border-color: var(--correct);
		color: var(--correct);
	}

	.keys {
		display: none;
	}

	.stage {
		display: grid;
		gap: var(--gap-lg);
	}

	.actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--gap-md);
	}

	/* DESIGN §10 desktop flashcards: a big centred card plus a deck panel with key hints. */
	@media (min-width: 1024px) {
		.deck {
			grid-template-columns: minmax(0, var(--sidebar-width)) minmax(0, var(--content-max));
			justify-content: center;
			align-items: start;
			gap: var(--gap-2xl);
		}

		.panel {
			padding: var(--gap-lg);
			border: var(--border-width) solid var(--outline);
			border-radius: var(--r-md);
			background: var(--surface);
		}

		.tallies {
			flex-direction: column;
			align-items: start;
		}

		.keys {
			display: grid;
			gap: var(--gap-xs);
			margin: 0;
			padding: 0;
			color: var(--text-soft);
			font-size: var(--type-small-size);
			list-style: none;
		}
	}

	kbd {
		padding: 0 var(--gap-xs);
		border: var(--hairline) solid var(--outline);
		border-radius: var(--r-xs);
		background: var(--surface-sunk);
		color: var(--text);
		font-family: var(--font-label);
	}
</style>
