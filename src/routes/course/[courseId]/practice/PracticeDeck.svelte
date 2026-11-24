<!--
	The Practice flashcard deck (SESSION_NOTES §C; Decisions log "Phase 8.6 Q4"): one pass through
	the in-scope cards; when it ends, the "Still learning" cards can go round again as a new pass.
	Nothing is logged, so the schedule never changes. Each rating plays the paw tap (SESSION_NOTES §D7).
-->
<script lang="ts">
	import type { DeckCard } from '#lib/services/practice-service.ts';
	import { prefs } from '#lib/services/preferences.svelte.ts';
	import FlashcardDeck from '#lib/ui/components/FlashcardDeck.svelte';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import { playSound } from '#lib/ui/delight/sound.ts';
	import FigureView from '#lib/ui/figures/FigureView.svelte';
	import type { MediaLoader } from '#lib/ui/figures/media-url.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { countOf } from '#lib/util/plural.ts';

	let { cards, menu, media }: { cards: DeckCard[]; menu: string; media: MediaLoader } = $props();

	/** A figure card's picture or diagram, shown above its flashcard. */
	const figures = $derived(
		new Map(
			cards.flatMap(({ cardId, exercise }) =>
				exercise.shape === 'selfRate' && exercise.figure ? [[cardId, exercise.figure] as const] : []
			)
		)
	);

	const views = $derived(
		cards.map(({ cardId, exercise }) => ({
			key: cardId,
			term: exercise.prompt,
			answer: exercise.shape === 'selfRate' ? exercise.answer : ''
		}))
	);
	// svelte-ignore state_referenced_locally
	let pass = $state(views);
	let round = $state(0);

	/** The next pass: only the "Still learning" cards, in the order they were swiped. */
	function again(learning: readonly string[]): void {
		const byKey = new Map<string, (typeof views)[number]>(views.map((view) => [view.key, view]));
		pass = learning.flatMap((key) => byKey.get(key) ?? []);
		round += 1;
	}
</script>

{#key round}
	<FlashcardDeck cards={pass} onrate={() => playSound('pawTap', 'practice', prefs.sounds)}>
		{#snippet above(key)}
			{@const figure = figures.get(key as DeckCard['cardId'])}
			{#if figure}
				<div data-deck-figure><FigureView {figure} {media} /></div>
			{/if}
		{/snippet}
		{#snippet done({ learning, known })}
			<StickyNote title="Deck done">
				<span data-deck-done
					>{countOf(known.length, 'card')} known, {learning.length} still learning.</span
				>
				Nothing here changes your schedule.
				{#snippet actions()}
					{#if learning.length > 0}
						<Button onclick={() => again(learning)} data-deck-again>
							Go again with {countOf(learning.length, 'card')}
						</Button>
					{/if}
					<Button variant={learning.length > 0 ? 'ghost' : 'primary'} href={menu}>
						Back to Practice
					</Button>
				{/snippet}
			</StickyNote>
		{/snippet}
	</FlashcardDeck>
{/key}
