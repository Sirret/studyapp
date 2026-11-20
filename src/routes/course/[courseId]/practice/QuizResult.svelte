<!--
	The quick quiz's end summary (Decisions log "Phase 8.6 Q18"): how many were right first time,
	and the cards missed along the way (each already came back once and was answered right).
-->
<script lang="ts">
	import type { CardId } from '#lib/db/schemas/common.ts';
	import type { QuizSummary } from '#lib/services/practice-service.ts';
	import StickyNote from '#lib/ui/components/StickyNote.svelte';
	import Stack from '#lib/ui/layout/Stack.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';

	let {
		summary,
		prompts,
		busy,
		course,
		onagain
	}: {
		summary: QuizSummary;
		/** Each card's question text, for the list of misses. */
		prompts: ReadonlyMap<CardId, string>;
		busy: boolean;
		course: string;
		onagain: () => void;
	} = $props();
</script>

<Stack gap="md">
	<StickyNote title="Quiz done">
		<span data-practice-summary>{summary.right} of {summary.asked} right first time.</span>
		Practice never changes your schedule.
		{#snippet actions()}
			<Button onclick={onagain} disabled={busy} data-quiz-again>Quiz again</Button>
			<Button variant="ghost" href={course}>Back to the course</Button>
		{/snippet}
	</StickyNote>
	{#if summary.missed.length > 0}
		<section aria-labelledby="missed-heading">
			<h2 id="missed-heading">Worth another look</h2>
			<ul data-quiz-missed>
				{#each summary.missed as id (id)}
					<li>{prompts.get(id) ?? 'A card that has since been removed'}</li>
				{/each}
			</ul>
		</section>
	{/if}
</Stack>

<style>
	h2 {
		margin: 0 0 var(--gap-sm);
		font-family: var(--font-label);
		font-size: var(--type-label-size-lg);
		letter-spacing: var(--type-label-tracking);
		color: var(--text-soft);
	}

	ul {
		margin: 0;
		padding-left: var(--gap-lg);
		display: grid;
		gap: var(--gap-xs);
	}
</style>
