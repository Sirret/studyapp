<!--
	Feedback panel (DESIGN §4, §7): a paper card, pine outline when right, oxblood dashed when wrong;: slides up under the card after every answer, right or wrong
	(feedback always shows the answer). Correct: ✓ and the answer; when a typo was let through,
	a line asking to check the spelling. Wrong: ✕, the right answer and, when the pick was another
	card's answer, the contrastive line. Actions come from the caller.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		correct,
		reveal,
		contrast,
		typo,
		note,
		actions
	}: {
		correct: boolean | null;
		reveal: string[];
		contrast?: { chosen: string; answers: string };
		/** Counted as right despite a typo: the spelling it matched, shown with a note. */
		typo?: string;
		note?: string;
		actions: Snippet;
	} = $props();

	const title = $derived(correct === null ? 'Here it is' : correct ? 'Correct' : 'Not quite');
</script>

<section
	class="feedback"
	class:right={correct === true}
	class:wrong={correct === false}
	role="status"
	aria-live="polite"
	data-feedback={correct === null ? 'neutral' : correct ? 'correct' : 'wrong'}
>
	<p class="title">
		{#if correct === true}<span class="icon" aria-hidden="true">✓</span>{/if}
		{#if correct === false}<span class="icon" aria-hidden="true">✕</span>{/if}
		{title}
	</p>
	{#if contrast}
		<p class="contrast">
			You chose <em>{contrast.chosen}</em> — that's the answer to <em>{contrast.answers}</em>.
		</p>
	{/if}
	{#if typo && correct === true}
		<p class="contrast" data-typo>
			Counted as right, with a small typo. It's spelled <em>{typo}</em>.
		</p>
	{/if}
	<div class="reveal">
		<span class="label">{correct === false ? 'The answer' : 'Answer'}</span>
		{#each reveal as line, i (i)}<span class="line">{line}</span>{/each}
	</div>
	{#if note}<p class="note">{note}</p>{/if}
	<div class="actions">{@render actions()}</div>
</section>

<style>
	.feedback {
		--feedback-border: var(--outline);
		--feedback-style: solid;
		--feedback-accent: var(--text-strong);

		display: grid;
		gap: var(--gap-sm);
		padding: var(--gap-lg);
		border: var(--stroke) var(--feedback-style) var(--feedback-border);
		border-radius: var(--r-md);
		background: var(--surface);
		color: var(--text);
		font-family: var(--font-body);
		font-size: var(--type-body-size);
		line-height: var(--type-body-leading);
		animation: rise var(--dur-base) var(--ease-out);
	}

	.right {
		--feedback-border: var(--correct);
		--feedback-accent: var(--correct);
	}

	.wrong {
		--feedback-border: var(--wrong);
		--feedback-style: dashed;
		--feedback-accent: var(--wrong);
	}

	.title {
		display: flex;
		align-items: center;
		gap: var(--gap-sm);
		margin: 0;
		color: var(--feedback-accent);
		font-family: var(--font-display);
		font-size: var(--type-term-size);
		line-height: var(--type-title-leading);
		font-weight: var(--type-display-weight);
		font-style: italic;
	}

	.icon {
		font-family: var(--font-body);
		font-size: var(--type-heading-size);
		font-style: normal;
		font-weight: var(--type-strong-weight);
	}

	.contrast,
	.note {
		margin: 0;
	}

	.note {
		color: var(--text-soft);
		font-size: var(--type-small-size);
	}

	.reveal {
		display: grid;
		gap: var(--gap-xs);
	}

	.label {
		color: var(--text-soft);
		font-family: var(--font-label);
		font-size: var(--type-label-size);
		font-weight: var(--type-label-weight);
		letter-spacing: var(--type-label-tracking);
		text-transform: uppercase;
	}

	.line {
		font-size: var(--type-answer-size);
		font-weight: var(--type-answer-weight);
		overflow-wrap: anywhere;
		white-space: pre-line;
	}

	.actions {
		display: grid;
		gap: var(--gap-sm);
		margin-top: var(--gap-sm);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(var(--rise-distance));
		}
	}
</style>
