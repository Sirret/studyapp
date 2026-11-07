<!--
	Feedback panel (DESIGN §5): slides up under the card after every answer, right or wrong
	(feedback always shows the answer). Correct: ✓ and the answer. Wrong: ✕, the right answer and,
	when the pick was another card's answer, the contrastive line. Actions come from the caller.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		correct,
		reveal,
		contrast,
		note,
		actions
	}: {
		correct: boolean | null;
		reveal: string[];
		contrast?: { chosen: string; answers: string };
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
	<div class="reveal">
		<span class="label">{correct === false ? 'The answer' : 'Answer'}</span>
		{#each reveal as line, i (i)}<span class="line">{line}</span>{/each}
	</div>
	{#if note}<p class="note">{note}</p>{/if}
	<div class="actions">{@render actions()}</div>
</section>

<style>
	.feedback {
		--feedback-bg: var(--surface-alt);
		--feedback-accent: var(--primary);

		display: grid;
		gap: var(--gap-sm);
		padding: var(--gap-lg);
		border-radius: var(--r-lg);
		background: var(--feedback-bg);
		animation: rise var(--dur-base) var(--ease-out);
	}

	.right {
		--feedback-bg: var(--success-soft);
		--feedback-accent: var(--success);
	}

	.wrong {
		--feedback-bg: var(--error-soft);
		--feedback-accent: var(--error);
	}

	.title {
		display: flex;
		align-items: center;
		gap: var(--gap-sm);
		margin: 0;
		color: var(--feedback-accent);
		font-size: var(--type-heading-size);
		line-height: var(--type-heading-leading);
		font-weight: var(--type-heading-weight);
	}

	.icon {
		font-weight: var(--type-display-weight);
	}

	.contrast,
	.note {
		margin: 0;
	}

	.note {
		color: var(--text-muted);
		font-size: var(--type-small-size);
	}

	.reveal {
		display: grid;
		gap: var(--gap-xs);
	}

	.label {
		color: var(--text-muted);
		font-size: var(--type-caption-size);
		font-weight: var(--type-caption-weight);
		text-transform: uppercase;
	}

	.line {
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
			transform: translateY(var(--space-12));
		}
	}
</style>
